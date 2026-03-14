import type {
  CompletenessResult,
  DetailedParsedSubmittal,
  ParsedSubmittal,
  RequiredDocument,
  RequirementSet,
  SubmittedDocument,
} from "../schemas/workflow";
import type { RequirementSet as ReconstructedRequirementSet } from "./requirements";

import { reviewCompletenessWithLlm } from "../completeness/reviewWithLlm";

type CompletenessInput = {
  parsedSubmittal: ParsedSubmittal;
  requirementSet: RequirementSet;
};

type NormalizedRequirement = {
  key: string;
  label: string;
  tokens: string[];
};

const normalizeValue = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const uniqueValues = (values: string[]): string[] => {
  const unique: string[] = [];

  for (const value of values) {
    if (unique.indexOf(value) === -1) {
      unique.push(value);
    }
  }

  return unique;
};

const buildRequirementTokens = (requirement: RequiredDocument): string[] =>
  uniqueValues(
    expandRequirementAliases([requirement.key, requirement.label, ...(requirement.aliases ?? [])])
      .map(normalizeValue)
      .filter(Boolean),
  );

const normalizeRequirement = (
  requirement: RequiredDocument,
): NormalizedRequirement | null => {
  const key = normalizeValue(requirement.key);
  const label = requirement.label.trim();
  const tokens = buildRequirementTokens(requirement);

  if (!key || !label || tokens.length === 0) {
    return null;
  }

  return {
    key,
    label,
    tokens,
  };
};

const buildDocumentSearchText = (document: SubmittedDocument): string =>
  normalizeValue([document.id, document.kind, document.title, document.sourceDocument ?? ""].join(" "));

const hasRequirementMatch = (
  requirement: NormalizedRequirement,
  submittedDocuments: SubmittedDocument[],
): boolean =>
  submittedDocuments.some((document) => {
    const text = buildDocumentSearchText(document);

    return requirement.tokens.some((token) => text.indexOf(token) !== -1);
  });

const findMissingDocumentsFromParser = (
  requirement: NormalizedRequirement,
  parserMissingDocuments: string[],
): boolean => {
  const normalizedMissingDocuments = parserMissingDocuments.map(normalizeValue);

  return requirement.tokens.some((token) =>
    normalizedMissingDocuments.some((missingDocument) => missingDocument.indexOf(token) !== -1),
  );
};

export const evaluateCompleteness = ({
  parsedSubmittal,
  requirementSet,
}: CompletenessInput): CompletenessResult => {
  const requiredDocuments = requirementSet.requiredDocuments.filter(
    (requirement) => requirement.required,
  );

  const ambiguousDocuments: string[] = [];
  const missingDocuments: string[] = [];

  for (const requirement of requiredDocuments) {
    const normalizedRequirement = normalizeRequirement(requirement);

    if (!normalizedRequirement) {
      ambiguousDocuments.push(requirement.label || requirement.key || "unnamed requirement");
      continue;
    }

    const isSubmitted = hasRequirementMatch(
      normalizedRequirement,
      parsedSubmittal.submittedDocuments,
    );
    const parserFlaggedMissing = findMissingDocumentsFromParser(
      normalizedRequirement,
      parsedSubmittal.missingDocuments,
    );

    if (!isSubmitted || parserFlaggedMissing) {
      missingDocuments.push(normalizedRequirement.label);
    }
  }

  const uniqueMissingDocuments = uniqueValues(missingDocuments);
  const uniqueAmbiguousDocuments = uniqueValues(ambiguousDocuments);

  if (uniqueMissingDocuments.length > 0) {
    return {
      status: "incomplete",
      isReviewable: false,
      missingDocuments: uniqueMissingDocuments,
      ambiguousDocuments: uniqueAmbiguousDocuments,
      rationale: {
        summary: "Mandatory documents are missing from the submittal package.",
        facts: [
          `${requiredDocuments.length} mandatory document requirement(s) evaluated.`,
          `${parsedSubmittal.submittedDocuments.length} submitted document(s) parsed.`,
          `${uniqueMissingDocuments.length} mandatory document(s) missing.`,
        ],
      },
    };
  }

  if (uniqueAmbiguousDocuments.length > 0) {
    return {
      status: "needs_human_review",
      isReviewable: false,
      missingDocuments: [],
      ambiguousDocuments: uniqueAmbiguousDocuments,
      rationale: {
        summary: "Document requirements contain ambiguous evidence and cannot be resolved deterministically.",
        facts: [
          `${requiredDocuments.length} mandatory document requirement(s) evaluated.`,
          `${uniqueAmbiguousDocuments.length} requirement definition(s) were ambiguous.`,
          "A human should confirm the unresolved requirement labels before review proceeds.",
        ],
      },
    };
  }

  return {
    status: "complete",
    isReviewable: true,
    missingDocuments: [],
    ambiguousDocuments: [],
    rationale: {
      summary: "All mandatory documents required for review are present.",
      facts: [
        `${requiredDocuments.length} mandatory document requirement(s) evaluated.`,
        `${parsedSubmittal.submittedDocuments.length} submitted document(s) parsed.`,
        "No mandatory documents were missing.",
      ],
    },
  };
};

export type LlmCompletenessInput = {
  parsedSubmittal: DetailedParsedSubmittal;
  requirementSet: ReconstructedRequirementSet;
  model?: string;
  allowDeterministicFallback?: boolean;
};

export async function runCompletenessAgent(
  input: LlmCompletenessInput,
): Promise<CompletenessResult> {
  try {
    const review = await reviewCompletenessWithLlm({
      parsedSubmittal: input.parsedSubmittal,
      requirementSet: input.requirementSet,
      model: input.model,
    });

    return {
      status: review.status,
      isReviewable: review.isReviewable,
      missingDocuments: review.missingDocuments,
      ambiguousDocuments: review.ambiguousDocuments,
      rationale: review.rationale,
      confidence: review.confidence,
      reviewMode: "llm",
      model:
        input.model ??
        process.env.ANTHROPIC_COMPLETENESS_MODEL ??
        process.env.ANTHROPIC_MODEL ??
        "claude-sonnet-4-5-20250929",
      evidence: review.evidence,
    };
  } catch (error) {
    if (!input.allowDeterministicFallback) {
      throw error;
    }

    const fallback = evaluateCompleteness(
      buildDeterministicCompletenessInput(
        input.parsedSubmittal,
        input.requirementSet,
      ),
    );

    const message =
      error instanceof Error ? error.message : "Unknown LLM completeness error.";

    return {
      ...fallback,
      confidence: "low",
      reviewMode: "deterministic_fallback",
      rationale: {
        summary: `${fallback.rationale.summary} Used deterministic fallback after the LLM path failed.`,
        facts: [...fallback.rationale.facts, message],
      },
      evidence: input.requirementSet.requiredDocuments
        .filter((document) => document.required)
        .map((document) => ({
          requirementKey: document.key,
          requirementLabel: document.label,
          decision: fallback.missingDocuments.includes(document.label)
            ? "missing"
            : fallback.ambiguousDocuments.includes(document.label)
              ? "ambiguous"
              : "present",
          matchedDocumentIds: findMatchedDocumentIds(
            document,
            input.parsedSubmittal.documentParses,
          ),
          reasoning:
            "Deterministic fallback used normalized document-title matching because the LLM review was unavailable.",
        })),
    };
  }
}

function buildDeterministicCompletenessInput(
  parsedSubmittal: DetailedParsedSubmittal,
  requirementSet: ReconstructedRequirementSet,
): CompletenessInput {
  return {
    parsedSubmittal: {
      specSection: parsedSubmittal.specSection.value ?? "",
      productType: parsedSubmittal.productType.value ?? "",
      manufacturer: parsedSubmittal.manufacturer.value ?? "",
      modelNumber: parsedSubmittal.modelNumber.value ?? "",
      revision: parsedSubmittal.revision.value ?? undefined,
      submittedDocuments: parsedSubmittal.documentParses.map((document) => ({
        id: document.documentId,
        kind: document.documentType,
        title: document.fileName,
        sourceDocument: document.fileName,
      })),
      missingDocuments: parsedSubmittal.missingDocuments,
      deviations: parsedSubmittal.deviations.map((issue) => issue.message),
    },
    requirementSet: {
      specSection: requirementSet.specSection.value,
      requiredAttributes: requirementSet.requiredAttributes.map(
        (attribute) => attribute.key,
      ),
      requiredDocuments: requirementSet.requiredDocuments.map((document) => ({
        key: document.key,
        label: document.label,
        required: document.required,
        aliases: expandRequirementAliases([document.label, document.key]),
      })),
      routingPolicy: requirementSet.routingPolicy.completeDestination,
    },
  };
}

function findMatchedDocumentIds(
  requirement: { key: string; label: string },
  documents: DetailedParsedSubmittal["documentParses"],
): string[] {
  const tokens = uniqueValues(
    expandRequirementAliases([requirement.key, requirement.label])
      .map(normalizeValue)
      .filter(Boolean),
  );

  return documents
    .filter((document) => {
      const text = normalizeValue(
        [document.documentId, document.documentType, document.fileName].join(" "),
      );

      return tokens.some((token) => text.indexOf(token) !== -1);
    })
    .map((document) => document.documentId);
}

function expandRequirementAliases(values: string[]): string[] {
  const expanded = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    expanded.add(value);

    const normalizedWhitespace = value.replace(/[_-]+/g, " ").trim();
    if (normalizedWhitespace) {
      expanded.add(normalizedWhitespace);
    }

    if (normalizedWhitespace.endsWith("s")) {
      expanded.add(normalizedWhitespace.slice(0, -1));
    }
  }

  return [...expanded];
}
