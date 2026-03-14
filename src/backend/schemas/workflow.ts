export type CompletenessStatus =
  | "complete"
  | "incomplete"
  | "needs_human_review";

export type ComparisonStatus =
  | "compliant"
  | "deviation_detected"
  | "unclear";

export type RoutingDestination =
  | "auto_route_internal_review"
  | "return_to_subcontractor"
  | "human_exception_queue";

export type SubmittedDocument = {
  id: string;
  kind: string;
  title: string;
  sourceDocument?: string;
};

export type ParsedSubmittal = {
  specSection: string;
  productType: string;
  manufacturer: string;
  modelNumber: string;
  revision?: string;
  submittedDocuments: SubmittedDocument[];
  missingDocuments: string[];
  deviations: string[];
};

export type RequiredDocument = {
  key: string;
  label: string;
  required: boolean;
  aliases?: string[];
};

export type RequirementSet = {
  specSection: string;
  requiredAttributes: string[];
  requiredDocuments: RequiredDocument[];
  routingPolicy: string;
};

export type CompletenessRationale = {
  summary: string;
  facts: string[];
};

export type CompletenessConfidence = "high" | "medium" | "low";

export type CompletenessReviewMode = "llm";

export type CompletenessEvidenceItem = {
  requirementKey: string;
  requirementLabel: string;
  decision: "present" | "missing" | "ambiguous";
  matchedDocumentIds: string[];
  reasoning: string;
};

export type CompletenessResult = {
  status: CompletenessStatus;
  isReviewable: boolean;
  missingDocuments: string[];
  ambiguousDocuments: string[];
  rationale: CompletenessRationale;
  confidence?: CompletenessConfidence;
  reviewMode?: CompletenessReviewMode;
  model?: string;
  evidence?: CompletenessEvidenceItem[];
};

export type ComparisonItem = {
  field: string;
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
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

export type RoutingDecision = {
  destination: RoutingDestination;
  actions: string[];
  rationale: string;
};

export type ExecutiveDecision = {
  decision:
    | "continue"
    | "return_to_subcontractor"
    | "escalate_to_human"
    | "approve_internal_progression";
  summary: string;
  reasoning: string[];
  nextActions: string[];
};

export type WorkflowLogEntry = {
  agent: string;
  message: string;
  timestamp: string;
};

export type WorkflowState = {
  runId: string;
  projectName: string;
  submittalTitle: string;
  currentStatus: string;
  incomingDocuments: string[];
  subcontractorEmail?: string;
  parsedSubmittal?: ParsedSubmittal;
  requirementSet?: RequirementSet;
  completenessResult?: CompletenessResult;
  comparisonResult?: ComparisonResult;
  routingDecision?: RoutingDecision;
  executiveDecision?: ExecutiveDecision;
  logs: WorkflowLogEntry[];
};

export type ParserConfidence = "high" | "medium" | "low";

export type ParseIssueCode =
  | "invalid_mime_type"
  | "file_missing"
  | "pdf_load_failed"
  | "ocr_required"
  | "empty_text"
  | "conflicting_values"
  | "missing_required_document"
  | "unresolved_field"
  | "deviation_detected";

export type ParseIssueSeverity = "info" | "warning" | "error";

export type ParsedDocumentType =
  | "submittal_cover"
  | "product_data"
  | "shop_drawing"
  | "compliance_certificate"
  | "o_and_m_manual"
  | "warranty"
  | "finish_sheet"
  | "deviation_letter"
  | "unknown";

export type ExtractionStatus =
  | "parsed"
  | "parsed_with_warnings"
  | "ocr_required"
  | "failed";

export type ParserStatus =
  | "parsed"
  | "parsed_with_warnings"
  | "needs_human_review";

export type DocumentFieldName =
  | "specSection"
  | "productType"
  | "manufacturer"
  | "modelNumber"
  | "revision";

export type SourceReference = {
  documentId: string;
  fileName: string;
  pageNumber?: number;
  excerpt?: string;
};

export type ParserIssue = {
  code: ParseIssueCode;
  severity: ParseIssueSeverity;
  message: string;
  documentId?: string;
  field?: DocumentFieldName;
  sources?: SourceReference[];
};

export type ParseTrace = {
  step: string;
  message: string;
  documentId?: string;
};

export type ExtractedAttribute = {
  name: string;
  value: string;
  confidence: ParserConfidence;
  sources: SourceReference[];
};

export type ParsedPackageMetadata = {
  projectName: SourcedValue<string>;
  projectNumber: SourcedValue<string>;
  submittalNumber: SourcedValue<string>;
  requirementReference: SourcedValue<string>;
  complianceStatement: SourcedValue<string>;
};

export type ParsedSubmittalItem = {
  itemId: string;
  label: SourcedValue<string>;
  productType: SourcedValue<string>;
  specSection: SourcedValue<string>;
  manufacturer: SourcedValue<string>;
  modelNumber: SourcedValue<string>;
  attributes: ExtractedAttribute[];
  requiredDocuments: string[];
  supportingDocuments: string[];
  confidence: ParserConfidence;
  sources: SourceReference[];
};

export type SourcedValue<T> = {
  value: T | null;
  confidence: ParserConfidence;
  sources: SourceReference[];
};

export type ParsedDocument = {
  documentId: string;
  fileName: string;
  documentType: ParsedDocumentType;
  extractionStatus: ExtractionStatus;
  pageCount?: number;
  textCoverage: number;
  detectedTextLength: number;
  issues: ParserIssue[];
};

export type DetailedParsedSubmittal = {
  packageMetadata?: ParsedPackageMetadata;
  items?: ParsedSubmittalItem[];
  specSection: SourcedValue<string>;
  productType: SourcedValue<string>;
  manufacturer: SourcedValue<string>;
  modelNumber: SourcedValue<string>;
  revision: SourcedValue<string>;
  extractedAttributes: ExtractedAttribute[];
  missingDocuments: string[];
  requiredDocuments?: string[];
  supportingDocuments?: string[];
  deviations: ParserIssue[];
  documentParses: ParsedDocument[];
  unresolvedFields: DocumentFieldName[];
  parserSummary: {
    status: ParserStatus;
    parsedDocumentCount: number;
    warningCount: number;
    errorCount: number;
    reviewedAt: string;
  };
  issues: ParserIssue[];
  trace: ParseTrace[];
};

export type IncomingDocument = {
  documentId: string;
  fileName: string;
  mimeType: string;
  filePath: string;
  declaredDocType?: ParsedDocumentType;
};

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

export type ExtractedPdf = {
  pageCount: number;
  pages: ExtractedPdfPage[];
  fullText: string;
  textCoverage: number;
  detectedTextLength: number;
  issues: ParserIssue[];
};
