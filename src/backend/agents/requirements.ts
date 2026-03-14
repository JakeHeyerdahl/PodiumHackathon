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
};

export type RequirementRoutingDestination =
  | "auto_route_internal_review"
  | "return_to_subcontractor"
  | "human_exception_queue";

export type RequirementSource =
  | "parsed_submittal"
  | "mock_project_context"
  | "submittal_title_inference"
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
  requiredAttributes: RequirementAttribute[];
  requiredDocuments: RequirementDocument[];
  routingPolicy: RoutingPolicy;
  rationale: string;
  assumptions: string[];
};

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
  {
    key: "shop_drawings",
    label: "Shop Drawings",
    required: true,
    rationale: "Review package should include dimensional or configuration details.",
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
  const normalizedProductType = normalizeToken(input.parsedSubmittal.productType);
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
    !parsedSpecSection && titleMatch?.specSection ? "submittal_title_inference" : null,
    !parsedSpecSection &&
    !titleMatch?.specSection &&
    context?.defaultSpecSection
      ? "mock_project_context"
      : null,
    resolvedSpecSection === "UNSPECIFIED" ? "default_policy" : null,
  ]);

  const requiredAttributes = mergeRequiredAttributes(
    { attributes: DEFAULT_REQUIRED_ATTRIBUTES, source: "default_policy" },
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
      });
    }
  }

  return [...documents.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
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
  const token = normalizeToken(value);

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
