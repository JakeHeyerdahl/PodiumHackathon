import { z } from "zod";

import { generateStructuredOutputWithAnthropic } from "../providers/anthropic";
import type {
  CompletenessConfidence,
  CompletenessEvidenceItem,
  CompletenessStatus,
  DetailedParsedSubmittal,
} from "../schemas/workflow";
import type { RequirementSet } from "../agents/requirements";

const completenessReviewSchema = z.object({
  status: z.enum(["complete", "incomplete", "needs_human_review"]),
  isReviewable: z.boolean(),
  missingDocuments: z.array(z.string()),
  ambiguousDocuments: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  rationaleSummary: z.string(),
  rationaleFacts: z.array(z.string()).min(1).max(6),
  evidence: z.array(
    z.object({
      requirementKey: z.string(),
      requirementLabel: z.string(),
      decision: z.enum(["present", "missing", "ambiguous"]),
      matchedDocumentIds: z.array(z.string()),
      reasoning: z.string(),
    }),
  ),
});

export type LlmCompletenessReview = {
  status: CompletenessStatus;
  isReviewable: boolean;
  missingDocuments: string[];
  ambiguousDocuments: string[];
  confidence: CompletenessConfidence;
  rationale: {
    summary: string;
    facts: string[];
  };
  evidence: CompletenessEvidenceItem[];
};

export type ReviewCompletenessWithLlmInput = {
  parsedSubmittal: DetailedParsedSubmittal;
  requirementSet: RequirementSet;
  model?: string;
};

function summarizeFieldValue(value: {
  value: string | null;
  confidence: CompletenessConfidence;
  sources: Array<{
    documentId: string;
    fileName: string;
    pageNumber?: number;
    excerpt?: string;
  }>;
}) {
  return {
    value: value.value,
    confidence: value.confidence,
    sources: value.sources.slice(0, 3),
  };
}

function buildPromptPayload(
  parsedSubmittal: DetailedParsedSubmittal,
  requirementSet: RequirementSet,
) {
  const requiredDocumentTokens = requirementSet.requiredDocuments
    .filter((document) => document.required)
    .map((document) => ({
      key: document.key,
      label: document.label,
      tokens: [document.key, document.label]
        .map((value) => normalizeToken(value))
        .filter(Boolean),
    }));

  const requiredParserMissingDocuments = parsedSubmittal.missingDocuments.filter(
    (missingDocument) => {
      const normalizedMissingDocument = normalizeToken(missingDocument);

      return requiredDocumentTokens.some((document) =>
        document.tokens.some(
          (token) =>
            normalizedMissingDocument.includes(token) ||
            token.includes(normalizedMissingDocument),
        ),
      );
    },
  );

  return {
    task:
      "Determine whether the submittal package is complete enough for review based only on required documents.",
    rules: [
      "Judge completeness, not technical compliance.",
      "Evaluate only the documents listed in requirementSet.requiredDocuments. Ignore any parser issue about a document that is not one of those required documents.",
      "Parser identity field issues (unresolved specSection, modelNumber, manufacturer, productType, revision, or similar fields) do not affect document completeness. Focus only on whether the required documents listed in requirementSet.requiredDocuments are present in the package.",
      "A required document is present only when the available evidence strongly supports that the document exists in the package.",
      "Use ambiguous when evidence is partial, low-quality, OCR-blocked, failed to parse, or conflicting.",
      "Use missing when the package lacks credible evidence of the required document.",
      "Treat requiredParserMissingDocuments as hints, not final truth. If an OCR-blocked or failed-to-classify document could plausibly satisfy a requirement, prefer ambiguous over missing.",
      "If the package contains a low-text, OCR-required, or unknown document that is the only plausible source for a required document, mark that requirement ambiguous unless there is strong counter-evidence.",
      "If any required document is missing, the overall status must be incomplete and isReviewable must be false.",
      "If nothing is missing but one or more required documents are ambiguous, the overall status must be needs_human_review and isReviewable must be false.",
      "Only return complete when every required document is credibly present.",
    ],
    requirementSet: {
      specSection: requirementSet.specSection,
      rationale: requirementSet.rationale,
      assumptions: requirementSet.assumptions,
      requiredDocuments: requirementSet.requiredDocuments
        .filter((document) => document.required)
        .map((document) => ({
          key: document.key,
          label: document.label,
          rationale: document.rationale ?? null,
          sources: document.sources,
        })),
    },
    parsedSubmittal: {
      parserSummary: {
        parsedDocumentCount: parsedSubmittal.parserSummary.parsedDocumentCount,
        warningCount: parsedSubmittal.parserSummary.warningCount,
        errorCount: parsedSubmittal.parserSummary.errorCount,
        reviewedAt: parsedSubmittal.parserSummary.reviewedAt,
      },
      requiredParserMissingDocuments,
      identity: {
        specSection: summarizeFieldValue(parsedSubmittal.specSection),
        productType: summarizeFieldValue(parsedSubmittal.productType),
        manufacturer: summarizeFieldValue(parsedSubmittal.manufacturer),
        modelNumber: summarizeFieldValue(parsedSubmittal.modelNumber),
        revision: summarizeFieldValue(parsedSubmittal.revision),
      },
      documents: parsedSubmittal.documentParses.map((document) => ({
        documentId: document.documentId,
        fileName: document.fileName,
        documentType: document.documentType,
        extractionStatus: document.extractionStatus,
        textCoverage: document.textCoverage,
        detectedTextLength: document.detectedTextLength,
        issues: document.issues.map((issue) => ({
          code: issue.code,
          severity: issue.severity,
          message: issue.message,
        })),
      })),
      issues: parsedSubmittal.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        documentId: issue.documentId ?? null,
      })),
      trace: parsedSubmittal.trace,
    },
  };
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, "");
}

export async function reviewCompletenessWithLlm(
  input: ReviewCompletenessWithLlmInput,
): Promise<LlmCompletenessReview> {
  const promptPayload = buildPromptPayload(
    input.parsedSubmittal,
    input.requirementSet,
  );

  const result = await generateStructuredOutputWithAnthropic({
    systemPrompt:
      "You are a construction submittal completeness reviewer. Return strict structured JSON. Be conservative: if required document evidence is weak or blocked, mark it ambiguous rather than present.",
    userPrompt: JSON.stringify(promptPayload),
    schema: completenessReviewSchema,
    maxTokens: 2000,
    model:
      input.model ??
      process.env.ANTHROPIC_COMPLETENESS_MODEL ??
      process.env.ANTHROPIC_MODEL ??
      "claude-sonnet-4-5-20250929",
  });

  const parsed = result.output;

  if (!parsed) {
    throw new Error(
      "The completeness model response could not be parsed.",
    );
  }

  return {
    status: parsed.status,
    isReviewable: parsed.isReviewable,
    missingDocuments: dedupeStrings(parsed.missingDocuments),
    ambiguousDocuments: dedupeStrings(parsed.ambiguousDocuments),
    confidence: parsed.confidence,
    rationale: {
      summary: parsed.rationaleSummary,
      facts: dedupeStrings(parsed.rationaleFacts),
    },
    evidence: parsed.evidence.map((item) => ({
      requirementKey: item.requirementKey,
      requirementLabel: item.requirementLabel,
      decision: item.decision,
      matchedDocumentIds: dedupeStrings(item.matchedDocumentIds),
      reasoning: item.reasoning,
    })),
  };
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
