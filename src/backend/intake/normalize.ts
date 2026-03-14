import { basename, extname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import type {
  IntakeDocument,
  IntakeEnvelope,
  IntakeResult,
  RawFixtureDocument,
  UploadIntakePayload,
} from "../schemas/intake";

type NormalizeSuccess = {
  ok: true;
  envelope: IntakeEnvelope;
  warnings: string[];
};

type NormalizeFailure = {
  ok: false;
  result: IntakeResult;
};

export type NormalizePayloadResult = NormalizeSuccess | NormalizeFailure;

const PDF_MIME_TYPES = new Set(["application/pdf"]);
const PASS_THROUGH_EXTENSIONS = new Set([
  ".txt",
  ".json",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

function buildDocumentId(fileName: string, index: number): string {
  const hash = createHash("sha1")
    .update(`${fileName}:${index}`)
    .digest("hex")
    .slice(0, 10);
  return `doc_${hash}`;
}

async function buildDocument(
  rawDocument: RawFixtureDocument,
  index: number,
  fixtureRoot: string,
): Promise<{ document: IntakeDocument; warningMessages: string[]; usable: boolean }> {
  const warningMessages: string[] = [];
  const fileName = basename(rawDocument.fileName || rawDocument.path || "").trim();
  const extension = extname(fileName).toLowerCase();
  const mimeType = rawDocument.mimeType;

  if (!fileName) {
    warningMessages.push("Document missing fileName.");
  }

  let byteSize: number | undefined;
  try {
    const stats = await fs.stat(resolve(fixtureRoot, rawDocument.path));
    byteSize = stats.size;
  } catch {
    warningMessages.push(`Could not read document at path: ${rawDocument.path}`);
  }

  let extractionStatus: IntakeDocument["extractionStatus"] = "not_started";
  let usable = true;

  if (extension === ".pdf" || PDF_MIME_TYPES.has(mimeType ?? "")) {
    extractionStatus = "not_started";
  } else if (PASS_THROUGH_EXTENSIONS.has(extension)) {
    extractionStatus = "skipped";
    warningMessages.push(`Unsupported non-PDF document will be skipped: ${fileName}`);
  } else {
    extractionStatus = "skipped";
    usable = false;
    warningMessages.push(`Unsupported document type: ${fileName}`);
  }

  return {
    usable,
    warningMessages,
    document: {
      documentId: buildDocumentId(fileName || rawDocument.path, index),
      fileName,
      extension,
      mimeType,
      byteSize,
      extractionStatus,
      warnings: warningMessages.length > 0 ? [...warningMessages] : undefined,
    },
  };
}

export async function normalizeIntakePayload(
  input: UploadIntakePayload,
  fixtureRoot: string,
): Promise<NormalizePayloadResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.projectName || input.projectName.trim().length === 0) {
    errors.push("projectName is required.");
  }

  const rawDocuments = input.documents ?? [];
  if (rawDocuments.length === 0) {
    errors.push("At least one document is required.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      result: {
        status: "rejected",
        errors,
        warnings,
        summary: "Intake rejected during payload validation.",
      },
    };
  }

  const seenNames = new Set<string>();
  const normalizedDocuments: IntakeDocument[] = [];
  let usableDocuments = 0;

  for (const [index, rawDocument] of rawDocuments.entries()) {
    const { document, warningMessages, usable } = await buildDocument(
      rawDocument,
      index,
      fixtureRoot,
    );

    if (document.fileName) {
      const normalizedName = document.fileName.toLowerCase();
      if (seenNames.has(normalizedName)) {
        warnings.push(`Duplicate filename detected: ${document.fileName}`);
        document.warnings = [...(document.warnings ?? []), "Duplicate filename detected."];
      }
      seenNames.add(normalizedName);
    }

    warnings.push(...warningMessages);
    if (usable) {
      usableDocuments += 1;
    }
    normalizedDocuments.push(document);
  }

  if (usableDocuments === 0) {
    return {
      ok: false,
      result: {
        status: "rejected",
        errors: ["All provided documents are unusable."],
        warnings,
        summary: "Intake rejected because no usable documents were found.",
      },
    };
  }

  const envelope: IntakeEnvelope = {
    runId: randomUUID(),
    sourceType: "upload",
    receivedAt: new Date().toISOString(),
    projectName: input.projectName!.trim(),
    documents: normalizedDocuments,
    warnings,
  };

  return {
    ok: true,
    envelope,
    warnings,
  };
}
