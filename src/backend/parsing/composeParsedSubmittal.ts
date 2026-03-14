import type {
  DetailedParsedSubmittal,
  DocumentFieldName,
  ExtractedAttribute,
  ParsedDocument,
  ParsedDocumentType,
  ParserIssue,
  ParserStatus,
  ParseTrace,
  SourcedValue,
  SourceReference,
} from "../schemas/workflow";
import type { ExtractedFieldCandidate } from "./extractDocumentFacts";

type ParseContext = {
  documents: ParsedDocument[];
  fieldCandidates: ExtractedFieldCandidate[];
  attributes: ExtractedAttribute[];
  deviations: ParserIssue[];
  expectedDocuments: string[];
  trace: ParseTrace[];
  reviewedAt: string;
};

const FIELD_PRECEDENCE: Record<DocumentFieldName, ParsedDocumentType[]> = {
  specSection: ["submittal_cover", "product_data", "shop_drawing", "unknown"],
  productType: ["submittal_cover", "product_data", "shop_drawing", "unknown"],
  manufacturer: ["product_data", "compliance_certificate", "shop_drawing", "unknown"],
  modelNumber: ["product_data", "compliance_certificate", "shop_drawing", "unknown"],
  revision: ["submittal_cover", "shop_drawing", "product_data", "unknown"],
};

function buildEmptyValue<T>(): SourcedValue<T> {
  return {
    value: null,
    confidence: "low",
    sources: [],
  };
}

function sortSources(sources: SourceReference[]): SourceReference[] {
  return [...sources].sort((left, right) => {
    const leftKey = `${left.documentId}:${left.pageNumber ?? 0}:${left.excerpt ?? ""}`;
    const rightKey = `${right.documentId}:${right.pageNumber ?? 0}:${right.excerpt ?? ""}`;
    return leftKey.localeCompare(rightKey);
  });
}

function pickFieldValue(
  field: DocumentFieldName,
  candidates: ExtractedFieldCandidate[],
  issues: ParserIssue[],
): SourcedValue<string> {
  const relevant = candidates.filter((candidate) => candidate.field === field);

  if (relevant.length === 0) {
    issues.push({
      code: "unresolved_field",
      severity: "warning",
      message: `Unable to resolve ${field} from provided documents.`,
      field,
    });
    return buildEmptyValue();
  }

  const precedence = FIELD_PRECEDENCE[field];
  const ordered = [...relevant].sort((left, right) => {
    const precedenceDelta =
      precedence.indexOf(left.documentType) - precedence.indexOf(right.documentType);

    if (precedenceDelta !== 0) {
      return precedenceDelta;
    }

    return left.value.localeCompare(right.value);
  });

  const winner = ordered[0];
  const competingValues = new Set(relevant.map((candidate) => candidate.value));
  if (competingValues.size > 1) {
    issues.push({
      code: "conflicting_values",
      severity: "warning",
      message: `Conflicting ${field} values detected. Selected "${winner.value}" by precedence.`,
      field,
      sources: sortSources(relevant.flatMap((candidate) => candidate.sources)),
    });
  }

  return {
    value: winner.value,
    confidence: winner.confidence,
    sources: sortSources(winner.sources),
  };
}

function dedupeAttributes(attributes: ExtractedAttribute[]): ExtractedAttribute[] {
  const byKey = new Map<string, ExtractedAttribute>();

  for (const attribute of attributes) {
    const key = `${attribute.name}:${attribute.value}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...attribute,
        sources: sortSources(attribute.sources),
      });
      continue;
    }

    existing.sources = sortSources([...existing.sources, ...attribute.sources]);
  }

  return [...byKey.values()].sort((left, right) =>
    `${left.name}:${left.value}`.localeCompare(`${right.name}:${right.value}`),
  );
}

function getMissingDocuments(
  documents: ParsedDocument[],
  expectedDocuments: string[],
  issues: ParserIssue[],
): string[] {
  const expected = new Set(expectedDocuments);

  if (expected.size === 0) {
    expected.add("product_data");
    expected.add("shop_drawing");
    expected.add("warranty");
    expected.add("o_and_m_manual");
  }

  const present = new Set(documents.map((document) => document.documentType));
  const missing = [...expected].filter(
    (documentType) => !present.has(documentType as ParsedDocumentType),
  );

  for (const missingDocument of missing) {
    issues.push({
      code: "missing_required_document",
      severity: "warning",
      message: `Required document "${missingDocument}" is missing from the package.`,
    });
  }

  return missing.sort();
}

export function composeParsedSubmittal(context: ParseContext): DetailedParsedSubmittal {
  const issues: ParserIssue[] = [];

  const specSection = pickFieldValue("specSection", context.fieldCandidates, issues);
  const productType = pickFieldValue("productType", context.fieldCandidates, issues);
  const manufacturer = pickFieldValue("manufacturer", context.fieldCandidates, issues);
  const modelNumber = pickFieldValue("modelNumber", context.fieldCandidates, issues);
  const revision = pickFieldValue("revision", context.fieldCandidates, issues);
  const extractedAttributes = dedupeAttributes(context.attributes);
  const missingDocuments = getMissingDocuments(
    context.documents,
    context.expectedDocuments,
    issues,
  );

  const mergedIssues = [...context.deviations, ...issues].sort((left, right) =>
    `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`),
  );
  const unresolvedFields = ([
    ["specSection", specSection],
    ["productType", productType],
    ["manufacturer", manufacturer],
    ["modelNumber", modelNumber],
    ["revision", revision],
  ] as const)
    .filter(([, value]) => value.value === null)
    .map(([field]) => field);

  const documentIssues = context.documents.flatMap((document) => document.issues);
  const hasReviewRequiredDocument = context.documents.some(
    (document) =>
      document.extractionStatus === "ocr_required" ||
      document.extractionStatus === "failed",
  );
  const errorCount =
    mergedIssues.filter((issue) => issue.severity === "error").length +
    documentIssues.filter((issue) => issue.severity === "error").length;
  const warningCount =
    mergedIssues.filter((issue) => issue.severity === "warning").length +
    documentIssues.filter((issue) => issue.severity === "warning").length;

  let status: ParserStatus = "parsed";
  if (errorCount > 0 || unresolvedFields.length > 0 || hasReviewRequiredDocument) {
    status = "needs_human_review";
  } else if (warningCount > 0 || missingDocuments.length > 0) {
    status = "parsed_with_warnings";
  }

  return {
    specSection,
    productType,
    manufacturer,
    modelNumber,
    revision,
    extractedAttributes,
    missingDocuments,
    deviations: context.deviations,
    documentParses: context.documents,
    unresolvedFields,
    parserSummary: {
      status,
      parsedDocumentCount: context.documents.length,
      warningCount,
      errorCount,
      reviewedAt: context.reviewedAt,
    },
    issues: mergedIssues,
    trace: context.trace,
  };
}
