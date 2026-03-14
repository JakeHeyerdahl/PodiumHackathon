import { z } from "zod";

import {
  createLlmProvider,
  type CreateLlmProviderOptions,
  type LlmProvider,
} from "../providers";
import type { SourceReference } from "../schemas/workflow";

const confidenceSchema = z.enum(["high", "medium", "low"]);

const sourceReferenceSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  pageNumber: z.number().int().positive().optional(),
  excerpt: z.string().trim().min(1).max(240).optional(),
});

const requirementAttributeSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  expectedValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  allowedValues: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .max(20),
  required: z.boolean(),
  rationale: z.string().trim().min(1).optional(),
  sources: z.array(sourceReferenceSchema).max(8),
});

const requirementDocumentSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean(),
  rationale: z.string().trim().min(1).optional(),
  sources: z.array(sourceReferenceSchema).max(8),
});

const requirementItemSchema = z.object({
  itemId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  productType: z.string().trim().min(1).nullable(),
  specSection: z.string().trim().min(1).nullable(),
  manufacturerRequirement: z.string().trim().min(1).nullable(),
  modelNumberRequirement: z.string().trim().min(1).nullable(),
  attributes: z.array(requirementAttributeSchema).max(30),
  requiredDocuments: z.array(requirementDocumentSchema).max(20),
  rationale: z.string().trim().min(1).optional(),
  sources: z.array(sourceReferenceSchema).max(8),
});

export const requirementDocumentReviewSchema = z.object({
  metadata: z.object({
    projectName: z.string().trim().min(1).nullable(),
    projectNumber: z.string().trim().min(1).nullable(),
    requirementDocumentId: z.string().trim().min(1).nullable(),
    specSection: z.string().trim().min(1).nullable(),
    confidence: confidenceSchema,
    sources: z.array(sourceReferenceSchema).max(8),
  }),
  items: z.array(requirementItemSchema).max(20),
  requiredDocuments: z.array(requirementDocumentSchema).max(20),
  deviationPolicy: z.object({
    substitutionsRequireApproval: z.boolean(),
    deviationsRequireApproval: z.boolean(),
    summary: z.string().trim().min(1),
  }),
  assumptions: z.array(z.string().trim().min(1)).max(10),
});

export type RequirementDocumentReview = z.infer<
  typeof requirementDocumentReviewSchema
>;

export type RequirementDocumentInput = {
  documentId: string;
  fileName: string;
  text: string;
};

export type ReviewRequirementDocumentWithLlmInput = {
  document: RequirementDocumentInput;
  model?: string;
  llmProvider?: LlmProvider;
} & CreateLlmProviderOptions;

const SYSTEM_PROMPT = `You are the Requirement Reconstruction Agent for construction submittal review.

Your job is to extract a structured requirement document from the supplied PDF text.

Rules:
- Return strict structured JSON only.
- Treat the document as the source of truth for requirements.
- Preserve package or item scope when the document covers multiple materials or components.
- Record required approval/support documents separately from technical attributes.
- If substitutions or deviations require approval, capture that in deviationPolicy.
- Do not invent requirements that are not grounded in the text.
- Use short evidence excerpts and document references from the input.
`;

function buildPromptPayload(document: RequirementDocumentInput) {
  return {
    task:
      "Extract the requirement document into a comparison-ready package requirement structure.",
    rules: [
      "Use items when the requirement document covers multiple materials, products, or components.",
      "Capture project and requirement-document identity in metadata.",
      "Capture required submittal/support documents both globally and per-item when clearly scoped.",
      "If an item requires a standard, performance threshold, color, finish, or other parameter, represent it as a structured attribute.",
      "If the document states that substitutions or deviations need approval, reflect that in deviationPolicy.",
    ],
    document,
  };
}

export function sanitizeRequirementSources(
  sources: SourceReference[],
  document: RequirementDocumentInput,
): SourceReference[] {
  return sources.map((source) => ({
    documentId: source.documentId || document.documentId,
    fileName: source.fileName || document.fileName,
    ...(source.pageNumber ? { pageNumber: source.pageNumber } : {}),
    ...(source.excerpt ? { excerpt: source.excerpt.slice(0, 240) } : {}),
  }));
}

export async function reviewRequirementDocumentWithLlm(
  input: ReviewRequirementDocumentWithLlmInput,
): Promise<RequirementDocumentReview> {
  const llmProvider =
    input.llmProvider ??
    createLlmProvider({
      provider: input.provider,
      anthropicApiKey: input.anthropicApiKey,
      anthropicModel: input.anthropicModel,
      allowMockFallback: input.allowMockFallback,
    });

  const response = await llmProvider.generateObject({
    instructions: SYSTEM_PROMPT,
    input: JSON.stringify(buildPromptPayload(input.document)),
    schema: requirementDocumentReviewSchema,
    schemaName: "requirement_document_review",
    model:
      input.model ??
      input.anthropicModel ??
      process.env.ANTHROPIC_REQUIREMENTS_MODEL ??
      process.env.ANTHROPIC_MODEL,
    maxOutputTokens: 2400,
  });

  return response.object;
}
