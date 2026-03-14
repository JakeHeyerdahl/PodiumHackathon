import type {
  IntakeDocument,
  IntakeResult,
  RawFixtureDocument,
  UploadIntakePayload,
} from "../schemas/intake";
import { extractPdfDocument } from "../intake/extractPdf";
import { normalizeIntakePayload } from "../intake/normalize";

export async function runIntakeAgent(
  input: UploadIntakePayload,
  fixtureRoot: string,
): Promise<IntakeResult> {
  const normalized = await normalizeIntakePayload(input, fixtureRoot);

  if (!normalized.ok) {
    return normalized.result;
  }

  const rawDocumentsByName = new Map<string, RawFixtureDocument[]>();
  for (const rawDocument of input.documents ?? []) {
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
