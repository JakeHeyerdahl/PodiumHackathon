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

const TOP_LEVEL_FIELDS = [
  "specSection",
  "productType",
  "manufacturer",
  "modelNumber",
  "revision",
] as const;

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
  if (isBlankValue(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is ComparisonPrimitive => !isBlankValue(entry))
      .map((entry) => normalizePrimitive(entry))
      .sort();
  }

  return normalizePrimitive(value);
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
