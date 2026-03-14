export type IntakeSourceType =
  | "upload"
  | "email"
  | "platform_export"
  | "shared_drive";

export type ExtractionStatus = "not_started" | "parsed" | "failed" | "skipped";

export type IntakeDocument = {
  documentId: string;
  fileName: string;
  extension: string;
  mimeType?: string;
  byteSize?: number;
  extractionStatus: ExtractionStatus;
  fullText?: string;
  warnings?: string[];
};

export type IntakeEnvelope = {
  runId: string;
  sourceType: "upload" | "email";
  receivedAt: string;
  projectName: string;
  documents: IntakeDocument[];
  warnings: string[];
};

export type RawFixtureDocument = {
  fileName: string;
  path: string;
  mimeType?: string;
};

export type UploadIntakePayload = {
  projectName?: string;
  submittalTitle?: string;
  sourceType?: "upload" | "email";
  emailId?: string;
  mailboxPath?: string;
  documents?: RawFixtureDocument[];
};

export type IntakeResult = {
  status: "accepted" | "accepted_with_warnings" | "rejected";
  envelope?: IntakeEnvelope;
  errors: string[];
  warnings: string[];
  summary: string;
};
