import type {
  IntakeDocument,
  IntakeResult,
  RawFixtureDocument,
  UploadIntakePayload,
} from "../schemas/intake";
import { extractPdfDocument } from "../intake/extractPdf";
import { normalizeIntakePayload } from "../intake/normalize";
import {
  getLatestMockInboundEmail,
  getMockInboundEmailById,
  toFixtureDocuments,
} from "../notifications/inboundEmail";

async function resolveEmailPayload(
  input: UploadIntakePayload,
): Promise<UploadIntakePayload> {
  if (input.sourceType !== "email") {
    return input;
  }

  const message = input.emailId
    ? await getMockInboundEmailById(input.emailId, input.mailboxPath)
    : await getLatestMockInboundEmail(input.mailboxPath);

  if (!message) {
    return {
      ...input,
      documents: [],
    };
  }

  return {
    projectName: input.projectName ?? "Email Intake",
    sourceType: "email",
    documents: toFixtureDocuments(message),
  };
}

export async function runIntakeAgent(
  input: UploadIntakePayload,
  fixtureRoot: string,
): Promise<IntakeResult> {
  const resolvedInput = await resolveEmailPayload(input);
  const normalized = await normalizeIntakePayload(resolvedInput, fixtureRoot);

  if (!normalized.ok) {
    return normalized.result;
  }

  const rawDocumentsByName = new Map<string, RawFixtureDocument[]>();
  for (const rawDocument of resolvedInput.documents ?? []) {
    const list = rawDocumentsByName.get(rawDocument.fileName) ?? [];
    list.push(rawDocument);
    rawDocumentsByName.set(rawDocument.fileName, list);
  }

  const extractedDocuments: IntakeDocument[] = [];
  for (const document of normalized.envelope.documents) {
    const candidates = rawDocumentsByName.get(document.fileName) ?? [];
    const rawDocument = candidates.shift();

    if (!rawDocument) {
      extractedDocuments.push({
        ...document,
        extractionStatus: document.extractionStatus === "not_started" ? "failed" : document.extractionStatus,
        warnings: [...(document.warnings ?? []), "Source document path was not found during extraction."],
      });
      continue;
    }

    const extractedDocument = await extractPdfDocument(fixtureRoot, {
      path: rawDocument.path,
      document,
    });
    extractedDocuments.push(extractedDocument);
  }

  const warnings = [...normalized.warnings];
  for (const document of extractedDocuments) {
    warnings.push(...(document.warnings ?? []));
  }

  const hasFailedPdf = extractedDocuments.some(
    (document) => document.extension === ".pdf" && document.extractionStatus === "failed",
  );
  const hasWarnings = warnings.length > 0;

  return {
    status: hasFailedPdf || hasWarnings ? "accepted_with_warnings" : "accepted",
    envelope: {
      ...normalized.envelope,
      sourceType: resolvedInput.sourceType === "email" ? "email" : "upload",
      documents: extractedDocuments,
      warnings,
    },
    errors: [],
    warnings,
    summary: hasFailedPdf
      ? "Intake accepted with warnings after one or more PDF extraction failures."
      : hasWarnings
        ? "Intake accepted with warnings."
        : "Intake accepted successfully.",
  };
}
