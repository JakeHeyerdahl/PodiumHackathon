export type IntakeSourceType =
  | "upload"
  | "email"
  | "platform_export"
  | "shared_drive";

export type DocumentCategoryHint =
  | "cover_sheet"
  | "product_data"
  | "shop_drawing"
  | "certification"
  | "test_report"
  | "deviation_sheet"
  | "schedule"
  | "spec_excerpt"
  | "unknown";

export type ExtractionStatus = "not_started" | "parsed" | "failed" | "skipped";

export type IntakePage = {
  pageNumber: number;
  text: string;
};

export type IntakeDocument = {
  documentId: string;
  fileName: string;
  extension: string;
  mimeType?: string;
  byteSize?: number;
  categoryHint?: DocumentCategoryHint;
  extractionStatus: ExtractionStatus;
  fullText?: string;
  pageCount?: number;
  pages?: IntakePage[];
  warnings?: string[];
};

export type SubmitterInfo = {
  company?: string;
  contactName?: string;
  email?: string;
};

export type IntakeEnvelope = {
  runId: string;
  sourceType: "upload";
  receivedAt: string;
  projectName: string;
  projectId?: string;
  submittalTitle?: string;
  packageLabel: string;
  submitter?: SubmitterInfo;
  documents: IntakeDocument[];
  warnings: string[];
};

export type RawFixtureDocument = {
  fileName: string;
  path: string;
  mimeType?: string;
  categoryHint?: DocumentCategoryHint;
};

export type UploadIntakePayload = {
  projectName?: string;
  projectId?: string;
  submittalTitle?: string;
  sourceType?: "upload";
  submitter?: SubmitterInfo;
  documents?: RawFixtureDocument[];
};

export type IntakeResult = {
  status: "accepted" | "accepted_with_warnings" | "rejected";
  envelope?: IntakeEnvelope;
  errors: string[];
  warnings: string[];
  summary: string;
};
