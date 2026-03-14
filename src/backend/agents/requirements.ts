import type {
  CreateLlmProviderOptions,
  LlmProvider,
} from "../providers";
import type { SourceReference } from "../schemas/workflow";
import { extractPdfText } from "../parsing/extractPdfText";
import type { IncomingDocument } from "../schemas/workflow";
import {
  reviewRequirementDocumentWithLlm,
  sanitizeRequirementSources,
} from "../requirements/reviewRequirementDocumentWithLlm";

export type SerializableValue = string | number | boolean | null;

export type ParsedSubmittal = {
  specSection?: string | null;
  productType?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  revision?: string | null;
  extractedAttributes?: Record<string, SerializableValue | undefined> | null;
  missingDocuments?: string[] | null;
  deviations?: string[] | null;
};

export type MockRequirementAttribute = {
  key: string;
  label?: string;
  required?: boolean;
  expectedValue?: SerializableValue;
  allowedValues?: SerializableValue[];
  rationale?: string;
};

export type MockRequirementDocument = {
  key: string;
  label?: string;
  required?: boolean;
  rationale?: string;
};

export type MockRoutingPolicy = {
  missingDocumentDestination?: RequirementRoutingDestination;
  deviationDestination?: RequirementRoutingDestination;
  completeDestination?: RequirementRoutingDestination;
  escalationTriggers?: string[];
};

export type MockProjectRequirementContext = {
  defaultSpecSection?: string | null;
  specSections?: Record<
    string,
    {
      requiredAttributes?: MockRequirementAttribute[];
      requiredDocuments?: MockRequirementDocument[];
      routingPolicy?: MockRoutingPolicy;
      rationale?: string;
    }
  >;
  productTypeRequirements?: Record<
    string,
    {
      requiredAttributes?: MockRequirementAttribute[];
      requiredDocuments?: MockRequirementDocument[];
      rationale?: string;
    }
  >;
  titleHints?: Record<
    string,
    {
      specSection?: string;
      requiredAttributes?: MockRequirementAttribute[];
      requiredDocuments?: MockRequirementDocument[];
      rationale?: string;
    }
  >;
  routingPolicy?: MockRoutingPolicy;
};

export type RequirementReconstructionInput = {
  projectName: string;
  submittalTitle: string;
  parsedSubmittal: ParsedSubmittal;
  mockProjectRequirementContext?: MockProjectRequirementContext;
  parsedRequirementDocument?: ParsedRequirementDocument;
};

export type RequirementRoutingDestination =
  | "auto_route_internal_review"
  | "return_to_subcontractor"
  | "human_exception_queue";

export type RequirementSource =
  | "parsed_submittal"
  | "mock_project_context"
  | "submittal_title_inference"
  | "requirement_document"
  | "default_policy";

export type RequirementAttribute = {
  key: string;
  label: string;
  required: boolean;
  expectedValue: SerializableValue | null;
  allowedValues: SerializableValue[];
  sources: RequirementSource[];
  rationale?: string;
};

export type RequirementDocument = {
  key: string;
  label: string;
  required: boolean;
  sources: RequirementSource[];
  rationale?: string;
  evidence?: SourceReference[];
};

export type RequirementItem = {
  itemId: string;
  label: string;
  productType?: string | null;
  specSection?: string | null;
  manufacturerRequirement?: SerializableValue;
  modelNumberRequirement?: SerializableValue;
  requiredAttributes: RequirementAttribute[];
  requiredDocuments: RequirementDocument[];
  sources: RequirementSource[];
  rationale?: string;
  evidence?: SourceReference[];
};

export type RoutingPolicy = {
  missingDocumentDestination: RequirementRoutingDestination;
  deviationDestination: RequirementRoutingDestination;
  completeDestination: RequirementRoutingDestination;
  escalationTriggers: string[];
  rationale: string;
};

export type RequirementSet = {
  specSection: {
    value: string;
    sources: RequirementSource[];
    rationale: string;
  };
  requirementDocumentReference?: string | null;
  requiredItems?: RequirementItem[];
  requiredAttributes: RequirementAttribute[];
  requiredDocuments: RequirementDocument[];
  routingPolicy: RoutingPolicy;
  rationale: string;
  assumptions: string[];
};

export type ParsedRequirementDocumentAttribute = {
  key: string;
  label: string;
  expectedValue: SerializableValue | null;
  allowedValues: SerializableValue[];
  required: boolean;
  rationale?: string;
  sources: SourceReference[];
};

export type ParsedRequirementDocumentItem = {
  itemId: string;
  label: string;
  productType?: string | null;
  specSection?: string | null;
  manufacturerRequirement?: string | null;
  modelNumberRequirement?: string | null;
  attributes: ParsedRequirementDocumentAttribute[];
  requiredDocuments: Array<{
    key: string;
    label: string;
    required: boolean;
    rationale?: string;
    sources: SourceReference[];
  }>;
  rationale?: string;
  sources: SourceReference[];
};

export type ParsedRequirementDocument = {
  metadata: {
    projectName?: string | null;
    projectNumber?: string | null;
    requirementDocumentId?: string | null;
    specSection?: string | null;
    confidence: "high" | "medium" | "low";
    sources: SourceReference[];
  };
  items: ParsedRequirementDocumentItem[];
  requiredDocuments: Array<{
    key: string;
    label: string;
    required: boolean;
    rationale?: string;
    sources: SourceReference[];
  }>;
  deviationPolicy: {
    substitutionsRequireApproval: boolean;
    deviationsRequireApproval: boolean;
    summary: string;
  };
  assumptions: string[];
};

export type ParseRequirementDocumentInput = {
  document: IncomingDocument;
  model?: string;
  llmProvider?: LlmProvider;
} & CreateLlmProviderOptions;

type AttributeSourceBundle = {
  attributes?: MockRequirementAttribute[];
  source: RequirementSource;
};

type DocumentSourceBundle = {
  documents?: MockRequirementDocument[];
  source: RequirementSource;
};

const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  missingDocumentDestination: "return_to_subcontractor",
  deviationDestination: "human_exception_queue",
  completeDestination: "auto_route_internal_review",
  escalationTriggers: [
    "missing required documents",
    "material deviation detected",
    "spec section could not be confidently resolved",
  ],
  rationale:
    "Default demo routing returns incomplete packages, escalates deviations, and forwards complete packages to internal review.",
};

const DEFAULT_REQUIRED_DOCUMENTS: MockRequirementDocument[] = [
  {
    key: "product_data",
    label: "Product Data",
    required: true,
    rationale: "Baseline technical literature is required for comparison.",
  },
];

const DEFAULT_REQUIRED_ATTRIBUTES: MockRequirementAttribute[] = [
  {
    key: "manufacturer",
    label: "Manufacturer",
    required: true,
    rationale: "Manufacturer identity is required for traceability.",
  },
  {
    key: "modelNumber",
    label: "Model Number",
    required: true,
    rationale: "Model number is required for exact product comparison.",
  },
];

export function buildRequirementSet(
  input: RequirementReconstructionInput,
): RequirementSet {
  const context = input.mockProjectRequirementContext;
  const normalizedTitle = normalizeToken(input.submittalTitle);
  const requirementDocument = input.parsedRequirementDocument;
  const normalizedProductType = normalizeToken(
    input.parsedSubmittal.productType ??
      requirementDocument?.items[0]?.productType ??
      requirementDocument?.items[0]?.label,
  );
  const parsedSpecSection = normalizeSpecSection(input.parsedSubmittal.specSection);
  const titleMatch = findTitleHint(normalizedTitle, context?.titleHints);
  const productTypeMatch = normalizedProductType
    ? findNormalizedRecordMatch(
        normalizedProductType,
        context?.productTypeRequirements,
        normalizeToken,
      )
    : undefined;

  const resolvedSpecSection =
    parsedSpecSection ??
    normalizeSpecSection(requirementDocument?.metadata.specSection) ??
    normalizeSpecSection(requirementDocument?.items[0]?.specSection) ??
    titleMatch?.specSection ??
    normalizeSpecSection(context?.defaultSpecSection) ??
    "UNSPECIFIED";

  const specSectionMatch = findNormalizedRecordMatch(
    resolvedSpecSection,
    context?.specSections,
    normalizeSpecSection,
  );

  const specSectionSources = uniqueSources([
    parsedSpecSection ? "parsed_submittal" : null,
    !parsedSpecSection && requirementDocument?.metadata.specSection ? "requirement_document" : null,
    !parsedSpecSection && titleMatch?.specSection ? "submittal_title_inference" : null,
    !parsedSpecSection &&
    !requirementDocument?.metadata.specSection &&
    !titleMatch?.specSection &&
    context?.defaultSpecSection
      ? "mock_project_context"
      : null,
    resolvedSpecSection === "UNSPECIFIED" ? "default_policy" : null,
  ]);

  const requiredAttributes = mergeRequiredAttributes(
    { attributes: DEFAULT_REQUIRED_ATTRIBUTES, source: "default_policy" },
    parsedRequirementDocumentAttributes(requirementDocument),
    {
      attributes: specSectionMatch?.requiredAttributes,
      source: "mock_project_context",
    },
    {
      attributes: productTypeMatch?.requiredAttributes,
      source: "mock_project_context",
    },
    {
      attributes: titleMatch?.requiredAttributes,
      source: "submittal_title_inference",
    },
    input.parsedSubmittal,
  );

  const requiredDocuments = mergeRequiredDocuments(
    { documents: DEFAULT_REQUIRED_DOCUMENTS, source: "default_policy" },
    parsedRequirementDocumentDocuments(requirementDocument),
    {
      documents: specSectionMatch?.requiredDocuments,
      source: "mock_project_context",
    },
    {
      documents: productTypeMatch?.requiredDocuments,
      source: "mock_project_context",
    },
    {
      documents: titleMatch?.requiredDocuments,
      source: "submittal_title_inference",
    },
  );

  const routingPolicy = mergeRoutingPolicy(
    DEFAULT_ROUTING_POLICY,
    context?.routingPolicy,
    specSectionMatch?.routingPolicy,
  );
  const requiredItems = buildRequiredItems(requirementDocument);

  const assumptions = buildAssumptions({
    projectName: input.projectName,
    resolvedSpecSection,
    parsedSpecSection,
    titleInferredSpecSection: titleMatch?.specSection,
    hasContext: Boolean(context),
    requiredAttributes,
    requiredDocuments,
  });

  return {
    specSection: {
      value: resolvedSpecSection,
      sources: specSectionSources,
      rationale: buildSpecSectionRationale(
        resolvedSpecSection,
        parsedSpecSection,
        titleMatch?.specSection,
        input.projectName,
      ),
    },
    requirementDocumentReference:
      requirementDocument?.metadata.requirementDocumentId ?? null,
    requiredItems,
    requiredAttributes,
    requiredDocuments,
    routingPolicy,
    rationale: buildRequirementSetRationale(
      resolvedSpecSection,
      specSectionMatch?.rationale,
      productTypeMatch?.rationale,
      titleMatch?.rationale,
    ),
    assumptions,
  };
}

export async function parseRequirementDocument(
  input: ParseRequirementDocumentInput,
): Promise<ParsedRequirementDocument> {
  const extractedPdf = await extractPdfText(input.document);

  const review = await reviewRequirementDocumentWithLlm({
    document: {
      documentId: input.document.documentId,
      fileName: input.document.fileName,
      text: extractedPdf.fullText,
    },
    model: input.model,
    llmProvider: input.llmProvider,
    provider: input.provider,
    anthropicApiKey: input.anthropicApiKey,
    anthropicModel: input.anthropicModel,
    allowMockFallback: input.allowMockFallback,
  });

  return {
    metadata: {
      projectName: review.metadata.projectName,
      projectNumber: review.metadata.projectNumber,
      requirementDocumentId: review.metadata.requirementDocumentId,
      specSection: review.metadata.specSection,
      confidence: review.metadata.confidence,
      sources: sanitizeRequirementSources(review.metadata.sources, {
        documentId: input.document.documentId,
        fileName: input.document.fileName,
        text: extractedPdf.fullText,
      }),
    },
    items: review.items.map((item) => ({
      itemId: item.itemId,
      label: item.label,
      productType: item.productType,
      specSection: item.specSection,
      manufacturerRequirement: item.manufacturerRequirement,
      modelNumberRequirement: item.modelNumberRequirement,
      attributes: item.attributes.map((attribute) => ({
        key: normalizeAttributeKey(attribute.key),
        label: attribute.label,
        expectedValue: attribute.expectedValue,
        allowedValues: attribute.allowedValues,
        required: attribute.required,
        rationale: attribute.rationale,
        sources: sanitizeRequirementSources(attribute.sources, {
          documentId: input.document.documentId,
          fileName: input.document.fileName,
          text: extractedPdf.fullText,
        }),
      })),
      requiredDocuments: item.requiredDocuments.map((document) => ({
        key: normalizeToken(document.key),
        label: document.label,
        required: document.required,
        rationale: document.rationale,
        sources: sanitizeRequirementSources(document.sources, {
          documentId: input.document.documentId,
          fileName: input.document.fileName,
          text: extractedPdf.fullText,
        }),
      })),
      rationale: item.rationale,
      sources: sanitizeRequirementSources(item.sources, {
        documentId: input.document.documentId,
        fileName: input.document.fileName,
        text: extractedPdf.fullText,
      }),
    })),
    requiredDocuments: review.requiredDocuments.map((document) => ({
      key: normalizeToken(document.key),
      label: document.label,
      required: document.required,
      rationale: document.rationale,
      sources: sanitizeRequirementSources(document.sources, {
        documentId: input.document.documentId,
        fileName: input.document.fileName,
        text: extractedPdf.fullText,
      }),
    })),
    deviationPolicy: review.deviationPolicy,
    assumptions: review.assumptions,
  };
}

function mergeRequiredAttributes(
  ...sources: Array<
    | AttributeSourceBundle
    | ParsedSubmittal
    | undefined
  >
): RequirementAttribute[] {
  const attributes = new Map<string, RequirementAttribute>();

  for (const source of sources) {
    if (!source || !("attributes" in source)) {
      continue;
    }

    for (const attribute of source.attributes ?? []) {
      const key = normalizeAttributeKey(attribute.key);
      const existing = attributes.get(key);

      attributes.set(key, {
        key,
        label: attribute.label ?? existing?.label ?? humanizeKey(key),
        required: attribute.required ?? existing?.required ?? true,
        expectedValue:
          attribute.expectedValue ?? existing?.expectedValue ?? null,
        allowedValues: dedupeSerializableValues([
          ...(existing?.allowedValues ?? []),
          ...(attribute.allowedValues ?? []),
        ]),
        sources: uniqueSources([
          ...(existing?.sources ?? []),
          source.source,
        ]),
        rationale: attribute.rationale ?? existing?.rationale,
      });
    }
  }

  const parsedSubmittal = sources.find(
    (source): source is ParsedSubmittal =>
      typeof source === "object" &&
      source !== null &&
      !("attributes" in source),
  );

  if (parsedSubmittal?.manufacturer) {
    seedAttributeExpectation(attributes, "manufacturer", parsedSubmittal.manufacturer);
  }

  if (parsedSubmittal?.modelNumber) {
    seedAttributeExpectation(attributes, "modelNumber", parsedSubmittal.modelNumber);
  }

  return [...attributes.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

function mergeRequiredDocuments(
  ...sources: Array<DocumentSourceBundle | undefined>
): RequirementDocument[] {
  const documents = new Map<string, RequirementDocument>();

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const document of source.documents ?? []) {
      const key = normalizeToken(document.key);
      const existing = documents.get(key);

      documents.set(key, {
        key,
        label: document.label ?? existing?.label ?? humanizeKey(key),
        required: document.required ?? existing?.required ?? true,
        sources: uniqueSources([
          ...(existing?.sources ?? []),
          source.source,
        ]),
        rationale: document.rationale ?? existing?.rationale,
        evidence: existing?.evidence,
      });
    }
  }

  return [...documents.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

function parsedRequirementDocumentAttributes(
  document?: ParsedRequirementDocument,
): AttributeSourceBundle | undefined {
  if (!document) {
    return undefined;
  }

  return {
    source: "requirement_document",
    attributes: document.items.flatMap((item) => [
      ...item.attributes.map((attribute) => ({
        key: attribute.key,
        label: attribute.label,
        required: attribute.required,
        expectedValue: attribute.expectedValue,
        allowedValues: attribute.allowedValues,
        rationale: attribute.rationale ?? item.rationale,
      })),
      ...(item.manufacturerRequirement
        ? [{
            key: "manufacturer",
            label: "Manufacturer",
            required: true,
            expectedValue: item.manufacturerRequirement,
            rationale: item.rationale,
          }]
        : []),
      ...(item.modelNumberRequirement
        ? [{
            key: "modelNumber",
            label: "Model Number",
            required: true,
            expectedValue: item.modelNumberRequirement,
            rationale: item.rationale,
          }]
        : []),
      ...(item.productType
        ? [{
            key: "productType",
            label: "Product Type",
            required: true,
            expectedValue: item.productType,
            rationale: item.rationale,
          }]
        : []),
    ]),
  };
}

function parsedRequirementDocumentDocuments(
  document?: ParsedRequirementDocument,
): DocumentSourceBundle | undefined {
  if (!document) {
    return undefined;
  }

  return {
    source: "requirement_document",
    documents: [
      ...document.requiredDocuments.map((requiredDocument) => ({
        key: requiredDocument.key,
        label: requiredDocument.label,
        required: requiredDocument.required,
        rationale: requiredDocument.rationale,
      })),
      ...document.items.flatMap((item) =>
        item.requiredDocuments.map((requiredDocument) => ({
          key: requiredDocument.key,
          label: requiredDocument.label,
          required: requiredDocument.required,
          rationale: requiredDocument.rationale ?? item.rationale,
        })),
      ),
    ],
  };
}

function buildRequiredItems(
  document?: ParsedRequirementDocument,
): RequirementItem[] | undefined {
  if (!document || document.items.length === 0) {
    return undefined;
  }

  return document.items.map((item) => ({
    itemId: item.itemId,
    label: item.label,
    productType: item.productType,
    specSection: item.specSection,
    manufacturerRequirement: item.manufacturerRequirement,
    modelNumberRequirement: item.modelNumberRequirement,
    requiredAttributes: item.attributes.map((attribute) => ({
      key: normalizeAttributeKey(attribute.key),
      label: attribute.label,
      required: attribute.required,
      expectedValue: attribute.expectedValue,
      allowedValues: attribute.allowedValues,
      sources: ["requirement_document"],
      rationale: attribute.rationale,
    })),
    requiredDocuments: item.requiredDocuments.map((requiredDocument) => ({
      key: normalizeToken(requiredDocument.key),
      label: requiredDocument.label,
      required: requiredDocument.required,
      sources: ["requirement_document"],
      rationale: requiredDocument.rationale,
      evidence: requiredDocument.sources,
    })),
    sources: ["requirement_document"],
    rationale: item.rationale,
    evidence: item.sources,
  }));
}

function mergeRoutingPolicy(
  base: RoutingPolicy,
  contextPolicy?: MockRoutingPolicy,
  specPolicy?: MockRoutingPolicy,
): RoutingPolicy {
  const mergedEscalationTriggers = [
    ...base.escalationTriggers,
    ...(contextPolicy?.escalationTriggers ?? []),
    ...(specPolicy?.escalationTriggers ?? []),
  ];

  return {
    missingDocumentDestination:
      specPolicy?.missingDocumentDestination ??
      contextPolicy?.missingDocumentDestination ??
      base.missingDocumentDestination,
    deviationDestination:
      specPolicy?.deviationDestination ??
      contextPolicy?.deviationDestination ??
      base.deviationDestination,
    completeDestination:
      specPolicy?.completeDestination ??
      contextPolicy?.completeDestination ??
      base.completeDestination,
    escalationTriggers: [...new Set(mergedEscalationTriggers)],
    rationale:
      specPolicy || contextPolicy
        ? "Routing policy combines project defaults with spec-specific overrides when present."
        : base.rationale,
  };
}

function seedAttributeExpectation(
  attributes: Map<string, RequirementAttribute>,
  key: string,
  expectedValue: string,
): void {
  const normalizedKey = normalizeAttributeKey(key);
  const existing = attributes.get(normalizedKey);

  attributes.set(normalizedKey, {
    key: normalizedKey,
    label: existing?.label ?? humanizeKey(normalizedKey),
    required: existing?.required ?? true,
    expectedValue: existing?.expectedValue ?? expectedValue,
    allowedValues: existing?.allowedValues ?? [],
    sources: uniqueSources([
      ...(existing?.sources ?? []),
      "parsed_submittal",
    ]),
    rationale:
      existing?.rationale ??
      "Parsed submittal identity fields are treated as the expected submission target for deterministic comparison.",
  });
}

function buildAssumptions(input: {
  projectName: string;
  resolvedSpecSection: string;
  parsedSpecSection: string | null;
  titleInferredSpecSection?: string;
  hasContext: boolean;
  requiredAttributes: RequirementAttribute[];
  requiredDocuments: RequirementDocument[];
}): string[] {
  const assumptions: string[] = [];

  if (!input.hasContext) {
    assumptions.push(
      "No mock project requirement context was provided, so baseline demo requirements were used.",
    );
  }

  if (!input.parsedSpecSection && input.titleInferredSpecSection) {
    assumptions.push(
      `Spec section was inferred from the submittal title as ${input.resolvedSpecSection}.`,
    );
  }

  if (input.resolvedSpecSection === "UNSPECIFIED") {
    assumptions.push(
      "Spec section could not be resolved, so the requirement set remains generic for safe comparison.",
    );
  }

  if (input.requiredAttributes.length === 0) {
    assumptions.push("No explicit required attributes were found after normalization.");
  }

  if (input.requiredDocuments.length === 0) {
    assumptions.push("No explicit required documents were found after normalization.");
  }

  return assumptions;
}

function buildSpecSectionRationale(
  resolvedSpecSection: string,
  parsedSpecSection: string | null,
  titleSpecSection: string | undefined,
  projectName: string,
): string {
  if (parsedSpecSection) {
    return `Requirement set is anchored to parsed spec section ${resolvedSpecSection} for ${projectName}.`;
  }

  if (titleSpecSection) {
    return `Requirement set uses title-based inference to map this submittal to spec section ${resolvedSpecSection}.`;
  }

  if (resolvedSpecSection === "UNSPECIFIED") {
    return "Requirement set falls back to a generic unresolved spec section for deterministic demo behavior.";
  }

  return `Requirement set uses the mock project default spec section ${resolvedSpecSection}.`;
}

function buildRequirementSetRationale(
  specSection: string,
  specRationale?: string,
  productTypeRationale?: string,
  titleRationale?: string,
): string {
  const rationaleParts = [
    `Normalized requirements prepared for comparison under spec section ${specSection}.`,
    specRationale,
    productTypeRationale,
    titleRationale,
  ].filter(Boolean);

  return rationaleParts.join(" ");
}

function findTitleHint(
  normalizedTitle: string,
  titleHints?: MockProjectRequirementContext["titleHints"],
) {
  if (!titleHints) {
    return undefined;
  }

  return Object.entries(titleHints).find(([pattern]) =>
    normalizedTitle.includes(normalizeToken(pattern)),
  )?.[1];
}

function findNormalizedRecordMatch<T>(
  lookupValue: string,
  record: Record<string, T> | undefined,
  normalizeKey: (value?: string | null) => string | null | string,
): T | undefined {
  if (!record) {
    return undefined;
  }

  const directMatch = record[lookupValue];
  if (directMatch) {
    return directMatch;
  }

  return Object.entries(record).find(([key]) => {
    const normalizedKey = normalizeKey(key);
    return normalizedKey === lookupValue;
  })?.[1];
}

function normalizeSpecSection(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+/g, " ").toUpperCase();
}

function normalizeToken(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeAttributeKey(value: string): string {
  const token = normalizeToken(
    value.replace(/([a-z0-9])([A-Z])/g, "$1_$2"),
  );

  if (token === "model_number" || token === "modelnumber") {
    return "modelNumber";
  }

  return token.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

function humanizeKey(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function dedupeSerializableValues(values: SerializableValue[]): SerializableValue[] {
  const unique = new Set(values.map((value) => JSON.stringify(value)));
  return [...unique].map((value) => JSON.parse(value) as SerializableValue);
}

function uniqueSources(
  sources: Array<RequirementSource | null | undefined>,
): RequirementSource[] {
  return [...new Set(sources.filter(Boolean) as RequirementSource[])];
}
