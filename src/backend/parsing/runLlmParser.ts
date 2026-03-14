import type {
  DetailedParsedSubmittal,
  DocumentFieldName,
  ParsedDocument,
  ParsedSubmittalItem,
  ParserIssue,
  ParserStatus,
  ParsedPackageMetadata,
  SourcedValue,
} from "../schemas/workflow";
import {
  buildReviewedAttributes,
  buildSourcedValue,
  buildUnresolvedFields,
  dedupeStrings,
  normalizeIssue,
  reviewParserWithLlm,
  sanitizeSources,
  sortIssues,
  type ExtractedParserDocument,
} from "./reviewWithLlm";
import type {
  CreateLlmProviderOptions,
  LlmProvider,
} from "../providers";

export type RunLlmParserInput = {
  documents: ExtractedParserDocument[];
  reviewedAt: string;
  model?: string;
  llmProvider?: LlmProvider;
} & CreateLlmProviderOptions;

function determineSummaryStatus(input: {
  overallStatus: ParserStatus;
  documents: ParsedDocument[];
  issues: ParserIssue[];
  missingDocuments: string[];
  unresolvedFields: DocumentFieldName[];
}): ParserStatus {
  const hasDocumentError = input.documents.some((document) =>
    document.issues.some((issue) => issue.severity === "error"),
  );

  if (
    input.overallStatus === "needs_human_review" ||
    hasDocumentError ||
    input.unresolvedFields.length > 0
  ) {
    return "needs_human_review";
  }

  const hasWarnings =
    input.issues.some((issue) => issue.severity === "warning") ||
    input.missingDocuments.length > 0 ||
    input.documents.some((document) =>
      document.issues.some((issue) => issue.severity === "warning"),
    );

  if (input.overallStatus === "parsed_with_warnings" || hasWarnings) {
    return "parsed_with_warnings";
  }

  return "parsed";
}

export async function runLlmParser({
  documents,
  reviewedAt,
  model,
  llmProvider,
  provider,
  anthropicApiKey,
  anthropicModel,
  allowMockFallback,
}: RunLlmParserInput): Promise<DetailedParsedSubmittal> {
  const usableDocuments = documents.filter(
    ({ parsedDocument, fullText }) =>
      parsedDocument.extractionStatus !== "failed" && fullText.trim().length > 0,
  );
  const documentById = new Map(
    documents.map((document) => [document.document.documentId, document]),
  );

  const review = await reviewParserWithLlm({
    documents: usableDocuments,
    model,
    llmProvider,
    provider,
    anthropicApiKey,
    anthropicModel,
    allowMockFallback,
  });

  const llmIssues = review.issues.map((issue) => normalizeIssue(issue, documentById));
  const deviations = review.deviations.map((issue) => normalizeIssue(issue, documentById));
  const missingDocuments = dedupeStrings(review.missingDocuments);
  const missingDocumentIssues: ParserIssue[] = missingDocuments.map((documentName) => ({
    code: "missing_required_document",
    severity: "warning",
    message: `Required document "${documentName}" is missing from the package.`,
  }));

  const fieldValues: Record<DocumentFieldName, SourcedValue<string>> = {
    specSection: buildSourcedValue(review.specSection, documentById),
    productType: buildSourcedValue(review.productType, documentById),
    manufacturer: buildSourcedValue(review.manufacturer, documentById),
    modelNumber: buildSourcedValue(review.modelNumber, documentById),
    revision: buildSourcedValue(review.revision, documentById),
  };

  const unresolvedFields = buildUnresolvedFields(fieldValues);
  const unresolvedFieldIssues: ParserIssue[] = unresolvedFields.map((field) => ({
    code: "unresolved_field",
    severity: "warning",
    message: `Unable to resolve ${field} from provided documents.`,
    field,
  }));

  const extractedAttributes = buildReviewedAttributes(review, documentById);
  const packageMetadata: ParsedPackageMetadata = {
    projectName: buildSourcedValue(review.packageMetadata.projectName, documentById),
    projectNumber: buildSourcedValue(review.packageMetadata.projectNumber, documentById),
    submittalNumber: buildSourcedValue(review.packageMetadata.submittalNumber, documentById),
    requirementReference: buildSourcedValue(
      review.packageMetadata.requirementReference,
      documentById,
    ),
    complianceStatement: buildSourcedValue(
      review.packageMetadata.complianceStatement,
      documentById,
    ),
  };
  const items: ParsedSubmittalItem[] = review.items.map((item) => ({
    itemId: item.itemId,
    label: buildSourcedValue(item.label, documentById),
    productType: buildSourcedValue(item.productType, documentById),
    specSection: buildSourcedValue(item.specSection, documentById),
    manufacturer: buildSourcedValue(item.manufacturer, documentById),
    modelNumber: buildSourcedValue(item.modelNumber, documentById),
    attributes: item.attributes.map((attribute) => ({
      name: attribute.name,
      value: attribute.value,
      confidence: attribute.confidence,
      sources: sanitizeSources(attribute.sources, documentById),
    })),
    requiredDocuments: dedupeStrings(item.requiredDocuments),
    supportingDocuments: dedupeStrings(item.supportingDocuments),
    confidence: item.confidence,
    sources: sanitizeSources(item.sources, documentById),
  }));

  const analysisByDocumentId = new Map(
    review.documentAnalyses.map((analysis) => [analysis.documentId, analysis]),
  );
  const documentParses: ParsedDocument[] = documents.map(({ document, parsedDocument }) => {
    const analysis = analysisByDocumentId.get(document.documentId);

    return {
      ...parsedDocument,
      documentType: analysis?.documentType ?? parsedDocument.documentType,
    };
  });

  const issues = sortIssues([
    ...llmIssues,
    ...deviations,
    ...missingDocumentIssues,
    ...unresolvedFieldIssues,
  ]);

  const parserSummaryStatus = determineSummaryStatus({
    overallStatus: review.overallStatus,
    documents: documentParses,
    issues,
    missingDocuments,
    unresolvedFields,
  });
  const warningCount =
    issues.filter((issue) => issue.severity === "warning").length +
    documentParses.flatMap((document) => document.issues).filter(
      (issue) => issue.severity === "warning",
    ).length;
  const errorCount =
    issues.filter((issue) => issue.severity === "error").length +
    documentParses.flatMap((document) => document.issues).filter(
      (issue) => issue.severity === "error",
    ).length;

  return {
    packageMetadata,
    items,
    specSection: fieldValues.specSection,
    productType: fieldValues.productType,
    manufacturer: fieldValues.manufacturer,
    modelNumber: fieldValues.modelNumber,
    revision: fieldValues.revision,
    extractedAttributes,
    missingDocuments,
    requiredDocuments: dedupeStrings(review.requiredDocuments),
    supportingDocuments: dedupeStrings(review.supportingDocuments),
    deviations,
    documentParses,
    unresolvedFields,
    parserSummary: {
      status: parserSummaryStatus,
      parsedDocumentCount: documentParses.length,
      warningCount,
      errorCount,
      reviewedAt,
    },
    issues,
    trace: [
      {
        step: "llm_parse",
        message: `Parsed ${usableDocuments.length} extracted document(s) with Anthropic model ${
          model ??
          process.env.ANTHROPIC_PARSER_MODEL ??
          process.env.ANTHROPIC_MODEL ??
          "claude-sonnet-4-5-20250929"
        }.`,
      },
    ],
  };
}
