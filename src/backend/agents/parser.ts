import { existsSync } from "node:fs";

import { classifyDocument } from "../parsing/classifyDocument";
import { composeParsedSubmittal } from "../parsing/composeParsedSubmittal";
import { extractDocumentFacts } from "../parsing/extractDocumentFacts";
import { extractPdfText } from "../parsing/extractPdfText";
import type {
  DetailedParsedSubmittal,
  IncomingDocument,
  ParsedDocument,
  ParseTrace,
} from "../schemas/workflow";

export async function parseSubmittal(
  incomingDocuments: IncomingDocument[],
  options?: { reviewedAt?: string },
): Promise<DetailedParsedSubmittal> {
  const reviewedAt = options?.reviewedAt ?? new Date().toISOString();
  const trace: ParseTrace[] = [
    {
      step: "intake",
      message: `Received ${incomingDocuments.length} document(s) for parsing.`,
    },
  ];
  const documents: ParsedDocument[] = [];
  const fieldCandidates = [];
  const attributes = [];
  const deviations = [];
  const expectedDocuments = new Set<string>();

  const sortedDocuments = [...incomingDocuments].sort((left, right) =>
    left.documentId.localeCompare(right.documentId),
  );

  for (const document of sortedDocuments) {
    if (!existsSync(document.filePath)) {
      documents.push({
        documentId: document.documentId,
        fileName: document.fileName,
        documentType: "unknown",
        extractionStatus: "failed",
        pageCount: 0,
        textCoverage: 0,
        detectedTextLength: 0,
        issues: [
          {
            code: "file_missing",
            severity: "error",
            message: `Document file not found at ${document.filePath}.`,
            documentId: document.documentId,
          },
        ],
      });
      trace.push({
        step: "validate",
        message: "Skipped missing document file.",
        documentId: document.documentId,
      });
      continue;
    }

    const extractedPdf = await extractPdfText(document);
    const documentType = classifyDocument(document, extractedPdf.fullText);
    const extractionStatus = extractedPdf.issues.some((issue) => issue.code === "pdf_load_failed")
      ? "failed"
      : extractedPdf.issues.some((issue) => issue.code === "ocr_required")
        ? "ocr_required"
        : extractedPdf.issues.length > 0
          ? "parsed_with_warnings"
          : "parsed";

    documents.push({
      documentId: document.documentId,
      fileName: document.fileName,
      documentType,
      extractionStatus,
      pageCount: extractedPdf.pageCount,
      textCoverage: extractedPdf.textCoverage,
      detectedTextLength: extractedPdf.detectedTextLength,
      issues: extractedPdf.issues,
    });

    trace.push({
      step: "extract",
      message: `Extracted ${extractedPdf.detectedTextLength} characters and classified document as ${documentType}.`,
      documentId: document.documentId,
    });

    if (extractedPdf.fullText.length === 0) {
      continue;
    }

    const facts = extractDocumentFacts({
      documentId: document.documentId,
      fileName: document.fileName,
      documentType,
      text: extractedPdf.fullText,
    });

    fieldCandidates.push(...facts.fieldCandidates);
    attributes.push(...facts.attributes);
    deviations.push(...facts.deviations);
    facts.expectedDocuments.forEach((expectedDocument) => expectedDocuments.add(expectedDocument));

    trace.push({
      step: "normalize",
      message: `Collected ${facts.fieldCandidates.length} field candidates and ${facts.attributes.length} attributes.`,
      documentId: document.documentId,
    });
  }

  trace.push({
    step: "compose",
    message: "Resolved document facts into a normalized ParsedSubmittal payload.",
  });

  return composeParsedSubmittal({
    documents,
    fieldCandidates,
    attributes,
    deviations,
    expectedDocuments: [...expectedDocuments],
    trace,
    reviewedAt,
  });
}
