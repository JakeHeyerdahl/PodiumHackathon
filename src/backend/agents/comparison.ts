import { z } from "zod";

import {
  createLlmProvider,
  type CreateLlmProviderOptions,
  type LlmProvider,
} from "../providers";

type ComparisonPrimitive = string | number | boolean;

export type ComparisonValue =
  | ComparisonPrimitive
  | ComparisonPrimitive[]
  | null
  | undefined;

export type ParsedSubmittal = {
  specSection?: string | null;
  productType?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  revision?: string | null;
  extractedAttributes?: Record<string, ComparisonValue>;
  deviations?: string[];
};

export type RequirementSet = {
  specSection?: string | null;
  productType?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  revision?: string | null;
  requiredAttributes?: Record<string, ComparisonValue>;
};

export type ComparisonStatus = "compliant" | "deviation_detected" | "unclear";

export type ComparisonItem = {
  field: string;
  expected: ComparisonValue;
  actual: ComparisonValue;
  note?: string;
};

export type ComparisonResult = {
  status: ComparisonStatus;
  matches: ComparisonItem[];
  mismatches: ComparisonItem[];
  unclearItems: ComparisonItem[];
  summary: {
    matchCount: number;
    mismatchCount: number;
    unclearCount: number;
  };
};

export type RunComparisonAgentInput = {
  parsedSubmittal: ParsedSubmittal;
  requirementSet: RequirementSet;
  model?: string;
  allowDeterministicFallback?: boolean;
  llmProvider?: LlmProvider;
} & CreateLlmProviderOptions;

const TOP_LEVEL_FIELDS = [
  "specSection",
  "productType",
  "manufacturer",
  "modelNumber",
  "revision",
] as const;

const comparisonResultSchema = z.object({
  status: z.enum(["compliant", "deviation_detected", "unclear"]),
  matches: z.array(
    z.object({
      field: z.string(),
      expected: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean()])),
        z.null(),
      ]),
      actual: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean()])),
        z.null(),
      ]),
      note: z.string().optional(),
    }),
  ),
  mismatches: z.array(
    z.object({
      field: z.string(),
      expected: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean()])),
        z.null(),
      ]),
      actual: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean()])),
        z.null(),
      ]),
      note: z.string().optional(),
    }),
  ),
  unclearItems: z.array(
    z.object({
      field: z.string(),
      expected: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean()])),
        z.null(),
      ]),
      actual: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean()])),
        z.null(),
      ]),
      note: z.string().optional(),
    }),
  ),
  summary: z.object({
    matchCount: z.number().int().nonnegative(),
    mismatchCount: z.number().int().nonnegative(),
    unclearCount: z.number().int().nonnegative(),
  }),
});

type StructuredComparisonResult = z.infer<typeof comparisonResultSchema>;

function isBlankValue(value: ComparisonValue): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0 || value.every((entry) => isBlankValue(entry));
  }

  return false;
}

function normalizePrimitive(value: ComparisonPrimitive): string {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  return String(value).trim().toLowerCase();
}

function normalizeValue(value: ComparisonValue): string | string[] | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is ComparisonPrimitive => !isBlankValue(entry))
      .map((entry) => normalizePrimitive(entry))
      .sort();
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return normalizePrimitive(value);
  }

  return null;
}

function valuesMatch(expected: ComparisonValue, actual: ComparisonValue): boolean {
  const normalizedExpected = normalizeValue(expected);
  const normalizedActual = normalizeValue(actual);

  if (normalizedExpected === null || normalizedActual === null) {
    return false;
  }

  if (Array.isArray(normalizedExpected) || Array.isArray(normalizedActual)) {
    if (!Array.isArray(normalizedExpected) || !Array.isArray(normalizedActual)) {
      return false;
    }

    if (normalizedExpected.length !== normalizedActual.length) {
      return false;
    }

    return normalizedExpected.every((value, index) => value === normalizedActual[index]);
  }

  return normalizedExpected === normalizedActual;
}

function buildItem(
  field: string,
  expected: ComparisonValue,
  actual: ComparisonValue,
  note?: string,
): ComparisonItem {
  return {
    field,
    expected: expected ?? null,
    actual: actual ?? null,
    ...(note ? { note } : {}),
  };
}

function buildComparisonPromptPayload(
  parsedSubmittal: ParsedSubmittal,
  requirementSet: RequirementSet,
) {
  return {
    task:
      "Compare the parsed submittal against the requirement set and classify each requirement as match, mismatch, or unclear.",
    rules: [
      "Evaluate technical comparison, not completeness routing.",
      "A mismatch means the submitted evidence clearly conflicts with a required value.",
      "An unclear item means the required value or submitted evidence is missing, blank, weak, or not specific enough to determine compliance.",
      "Declared deviations should be treated as mismatches.",
      "Only return compliant when there are no mismatches and no unclear items.",
      "Return summary counts that exactly match the lengths of matches, mismatches, and unclearItems.",
      "Do not invent fields outside the provided parsedSubmittal and requirementSet.",
    ],
    parsedSubmittal,
    requirementSet,
  };
}

function toStructuredComparisonItem(item: ComparisonItem) {
  return {
    field: item.field,
    expected: item.expected ?? null,
    actual: item.actual ?? null,
    ...(item.note ? { note: item.note } : {}),
  };
}

function toStructuredComparisonResult(
  result: ComparisonResult,
): StructuredComparisonResult {
  return {
    status: result.status,
    matches: result.matches.map(toStructuredComparisonItem),
    mismatches: result.mismatches.map(toStructuredComparisonItem),
    unclearItems: result.unclearItems.map(toStructuredComparisonItem),
    summary: result.summary,
  };
}

export function runTechnicalComparisonAgent(
  parsedSubmittal: ParsedSubmittal,
  requirementSet: RequirementSet,
): ComparisonResult {
  const matches: ComparisonItem[] = [];
  const mismatches: ComparisonItem[] = [];
  const unclearItems: ComparisonItem[] = [];

  for (const field of TOP_LEVEL_FIELDS) {
    const expected = requirementSet[field];
    const actual = parsedSubmittal[field];

    if (isBlankValue(expected)) {
      continue;
    }

    if (isBlankValue(actual)) {
      unclearItems.push(
        buildItem(field, expected, actual, "Submitted evidence is missing for this required field."),
      );
      continue;
    }

    if (valuesMatch(expected, actual)) {
      matches.push(buildItem(field, expected, actual));
      continue;
    }

    mismatches.push(buildItem(field, expected, actual));
  }

  const requiredAttributes = requirementSet.requiredAttributes ?? {};
  const submittedAttributes = parsedSubmittal.extractedAttributes ?? {};

  for (const field in requiredAttributes) {
    const expected = requiredAttributes[field];
    const actual = submittedAttributes[field];

    if (isBlankValue(expected)) {
      unclearItems.push(
        buildItem(field, expected, actual, "Requirement value is missing or empty for this attribute."),
      );
      continue;
    }

    if (isBlankValue(actual)) {
      unclearItems.push(
        buildItem(field, expected, actual, "Submitted evidence is missing for this required attribute."),
      );
      continue;
    }

    if (valuesMatch(expected, actual)) {
      matches.push(buildItem(field, expected, actual));
      continue;
    }

    mismatches.push(buildItem(field, expected, actual));
  }

  for (const deviation of parsedSubmittal.deviations ?? []) {
    if (deviation.trim().length === 0) {
      continue;
    }

    mismatches.push(
      buildItem("declaredDeviation", null, deviation, "Parsed submittal includes a declared deviation."),
    );
  }

  const status: ComparisonStatus =
    mismatches.length > 0 ? "deviation_detected" : unclearItems.length > 0 ? "unclear" : "compliant";

  return {
    status,
    matches,
    mismatches,
    unclearItems,
    summary: {
      matchCount: matches.length,
      mismatchCount: mismatches.length,
      unclearCount: unclearItems.length,
    },
  };
}

export async function runComparisonAgent(
  input: RunComparisonAgentInput,
): Promise<ComparisonResult> {
  const deterministicResult = runTechnicalComparisonAgent(
    input.parsedSubmittal,
    input.requirementSet,
  );
  const structuredDeterministicResult =
    toStructuredComparisonResult(deterministicResult);
  const llmProvider =
    input.llmProvider ??
    createLlmProvider({
      provider: input.provider,
      anthropicApiKey: input.anthropicApiKey,
      anthropicModel: input.anthropicModel,
      allowMockFallback: input.allowMockFallback,
    });

  try {
    const response = await llmProvider.generateObject({
      instructions:
        "You are a construction submittal technical comparison agent. Return strict structured JSON and classify evidence conservatively when compliance is uncertain.",
      input: JSON.stringify(
        buildComparisonPromptPayload(
          input.parsedSubmittal,
          input.requirementSet,
        ),
      ),
      schema: comparisonResultSchema,
      schemaName: "comparison_result",
      model:
        input.model ??
        input.anthropicModel ??
        process.env.ANTHROPIC_COMPARISON_MODEL ??
        process.env.ANTHROPIC_MODEL,
      maxOutputTokens: 1800,
      fallbackObject: structuredDeterministicResult,
    });

    return response.object;
  } catch (error) {
    if (!input.allowDeterministicFallback) {
      throw error;
    }

    return deterministicResult;
  }
}
