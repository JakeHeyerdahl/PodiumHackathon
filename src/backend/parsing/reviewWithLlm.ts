import { z } from "zod";

import { generateStructuredOutputWithAnthropic } from "../providers/anthropic";
import type {
  DocumentFieldName,
  ExtractedAttribute,
  IncomingDocument,
  ParsedDocument,
  ParserIssue,
  SourcedValue,
  SourceReference,
} from "../schemas/workflow";

const confidenceSchema = z.enum(["high", "medium", "low"]);
const documentTypeSchema = z.enum([
  "submittal_cover",
  "product_data",
  "shop_drawing",
  "compliance_certificate",
  "o_and_m_manual",
  "warranty",
  "finish_sheet",
  "deviation_letter",
  "unknown",
]);
const issueCodeSchema = z.enum([
  "conflicting_values",
  "missing_required_document",
  "unresolved_field",
  "deviation_detected",
]);
const issueSeveritySchema = z.enum(["info", "warning", "error"]);
const fieldNameSchema = z.enum([
  "specSection",
  "productType",
  "manufacturer",
  "modelNumber",
  "revision",
]);

const sourceReferenceSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  pageNumber: z.number().int().positive().optional(),
  excerpt: z.string().trim().min(1).max(240).optional(),
});

const sourcedFieldSchema = z.object({
  value: z.string().trim().min(1).nullable(),
  confidence: confidenceSchema,
  sources: z.array(sourceReferenceSchema).max(8),
});

const attributeSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().trim().min(1),
  confidence: confidenceSchema,
  sources: z.array(sourceReferenceSchema).max(8),
});

const parserIssueSchema = z.object({
  code: issueCodeSchema,
  severity: issueSeveritySchema,
  message: z.string().trim().min(1),
  documentId: z.string().optional(),
  field: fieldNameSchema.optional(),
  sources: z.array(sourceReferenceSchema).max(8).optional(),
});

const documentAnalysisSchema = z.object({
  documentId: z.string(),
  documentType: documentTypeSchema,
  summary: z.string().trim().min(1),
  confidence: confidenceSchema,
});

export const parserReviewSchema = z.object({
  specSection: sourcedFieldSchema,
  productType: sourcedFieldSchema,
  manufacturer: sourcedFieldSchema,
  modelNumber: sourcedFieldSchema,
  revision: sourcedFieldSchema,
  extractedAttributes: z.array(attributeSchema).max(20),
  missingDocuments: z.array(z.string().trim().min(1)).max(20),
  deviations: z.array(parserIssueSchema).max(20),
  issues: z.array(parserIssueSchema).max(20),
  documentAnalyses: z.array(documentAnalysisSchema),
  overallStatus: z.enum(["parsed", "parsed_with_warnings", "needs_human_review"]),
});

export type ParserLlmReview = z.infer<typeof parserReviewSchema>;

export type ExtractedParserDocument = {
  document: IncomingDocument;
  parsedDocument: ParsedDocument;
  fullText: string;
};

export type ReviewParserWithLlmInput = {
  documents: ExtractedParserDocument[];
  model?: string;
};

const PARSER_SYSTEM_PROMPT = `You are the Parsing Agent in an autonomous construction submittal orchestration backend.

Your job is to extract structured submittal facts from provided document text.

Rules:
- Return strict structured JSON only.
- Use only the provided evidence.
- Do not invent values that are not grounded in document text.
- If evidence conflicts, choose the most defensible value and add a conflicting_values issue.
- If a field cannot be resolved confidently, return value null with low confidence.
- Mark explicit substitutions, deviations, or exceptions as deviation_detected issues.
- Classify each document into exactly one documentType.
- Keep outputs concise, operational, and backend-oriented.
- Sources must reference the documentId and fileName from the input.
- Use short excerpt snippets, not full document text.
- Prefer submittal covers and product data over weaker supporting documents when choosing core identity fields.
`;

function buildPromptPayload(documents: ExtractedParserDocument[]) {
  return {
    task:
      "Extract the normalized parsed submittal facts for this package using only the supplied document evidence.",
    rules: [
      "The package-level identity should be based on the strongest available evidence.",
      "missingDocuments should list package documents clearly implied by the available evidence but absent from the package.",
      "If a document has no usable text, do not infer facts from it.",
      "When a conflict exists, preserve the chosen value and record a conflicting_values issue.",
    ],
    documents: documents.map(({ document, parsedDocument, fullText }) => ({
      documentId: document.documentId,
      fileName: document.fileName,
      mimeType: document.mimeType,
      declaredDocType: document.declaredDocType ?? null,
      extractionStatus: parsedDocument.extractionStatus,
      pageCount: parsedDocument.pageCount ?? 0,
      textCoverage: parsedDocument.textCoverage,
      detectedTextLength: parsedDocument.detectedTextLength,
      extractionIssues: parsedDocument.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      })),
      text: fullText,
    })),
  };
}

export async function reviewParserWithLlm(
  input: ReviewParserWithLlmInput,
): Promise<ParserLlmReview> {
  const result = await generateStructuredOutputWithAnthropic({
    systemPrompt: PARSER_SYSTEM_PROMPT,
    userPrompt: JSON.stringify(buildPromptPayload(input.documents)),
    schema: parserReviewSchema,
    maxTokens: 2500,
    model:
      input.model ??
      process.env.ANTHROPIC_PARSER_MODEL ??
      process.env.ANTHROPIC_MODEL ??
      "claude-sonnet-4-5-20250929",
  });

  return result.output;
}

export function sanitizeSources(
  sources: SourceReference[],
  documentById: Map<string, ExtractedParserDocument>,
): SourceReference[] {
  return sources
    .map((source) => {
      const matchedDocument = documentById.get(source.documentId);

      return {
        documentId: source.documentId,
        fileName: source.fileName || matchedDocument?.document.fileName || "unknown",
        ...(source.pageNumber ? { pageNumber: source.pageNumber } : {}),
        ...(source.excerpt ? { excerpt: source.excerpt.slice(0, 240) } : {}),
      };
    })
    .slice(0, 8);
}

export function buildSourcedValue(
  value: ParserLlmReview["specSection"],
  documentById: Map<string, ExtractedParserDocument>,
): SourcedValue<string> {
  if (!value.value) {
    return {
      value: null,
      confidence: "low",
      sources: [],
    };
  }

  return {
    value: value.value,
    confidence: value.confidence,
    sources: sanitizeSources(value.sources, documentById),
  };
}

export function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function sortIssues(issues: ParserIssue[]): ParserIssue[] {
  return [...issues].sort((left, right) =>
    `${left.code}:${left.field ?? ""}:${left.documentId ?? ""}:${left.message}`.localeCompare(
      `${right.code}:${right.field ?? ""}:${right.documentId ?? ""}:${right.message}`,
    ),
  );
}

export function normalizeIssue(
  issue: ParserLlmReview["issues"][number],
  documentById: Map<string, ExtractedParserDocument>,
): ParserIssue {
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    ...(issue.documentId ? { documentId: issue.documentId } : {}),
    ...(issue.field ? { field: issue.field } : {}),
    ...(issue.sources
      ? { sources: sanitizeSources(issue.sources, documentById) }
      : {}),
  };
}

export function buildReviewedAttributes(
  review: ParserLlmReview,
  documentById: Map<string, ExtractedParserDocument>,
): ExtractedAttribute[] {
  return review.extractedAttributes.map((attribute) => ({
    name: attribute.name,
    value: attribute.value,
    confidence: attribute.confidence,
    sources: sanitizeSources(attribute.sources, documentById),
  }));
}

export function buildUnresolvedFields(
  fields: Record<DocumentFieldName, SourcedValue<string>>,
): DocumentFieldName[] {
  return (Object.entries(fields) as Array<[DocumentFieldName, SourcedValue<string>]>)
    .filter(([, value]) => value.value === null)
    .map(([field]) => field);
}
