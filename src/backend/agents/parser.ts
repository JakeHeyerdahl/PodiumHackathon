import { existsSync } from "node:fs";

import { classifyDocument } from "../parsing/classifyDocument";
import { composeParsedSubmittal } from "../parsing/composeParsedSubmittal";
import { extractDocumentFacts } from "../parsing/extractDocumentFacts";
import { extractPdfText } from "../parsing/extractPdfText";
import { runLlmParser } from "../parsing/runLlmParser";
import type {
  DetailedParsedSubmittal,
  IncomingDocument,
  ParsedDocument,
  ParseTrace,
} from "../schemas/workflow";

export type ParserAgentOptions = {
  reviewedAt?: string;
  model?: string;
  mode?: "llm" | "deterministic";
};

type ExtractedParserDocument = {
  document: IncomingDocument;
  parsedDocument: ParsedDocument;
  fullText: string;
};

async function extractParserDocuments(
  incomingDocuments: IncomingDocument[],
): Promise<{
  trace: ParseTrace[];
  documents: ExtractedParserDocument[];
}> {
  const trace: ParseTrace[] = [
    {
      step: "intake",
      message: `Received ${incomingDocuments.length} document(s) for parsing.`,
    },
  ];
  const documents: ExtractedParserDocument[] = [];

  const sortedDocuments = [...incomingDocuments].sort((left, right) =>
    left.documentId.localeCompare(right.documentId),
  );

  for (const document of sortedDocuments) {
    if (!existsSync(document.filePath)) {
      documents.push({
        document,
        fullText: "",
        parsedDocument: {
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
        },
      });
      trace.push({
        step: "validate",
        message: "Skipped missing document file.",
        documentId: document.documentId,
      });
      continue;
    }

    const extractedPdf = await extractPdfText(document);
    const extractionStatus = extractedPdf.issues.some((issue) => issue.code === "pdf_load_failed")
      ? "failed"
      : extractedPdf.issues.some((issue) => issue.code === "ocr_required")
        ? "ocr_required"
        : extractedPdf.issues.length > 0
          ? "parsed_with_warnings"
          : "parsed";
    const documentType = extractedPdf.fullText.length > 0
      ? classifyDocument(document, extractedPdf.fullText)
      : "unknown";

    documents.push({
      document,
      fullText: extractedPdf.fullText,
      parsedDocument: {
        documentId: document.documentId,
        fileName: document.fileName,
        documentType,
        extractionStatus,
        pageCount: extractedPdf.pageCount,
        textCoverage: extractedPdf.textCoverage,
        detectedTextLength: extractedPdf.detectedTextLength,
        issues: extractedPdf.issues,
      },
    });

    trace.push({
      step: "extract",
      message: `Extracted ${extractedPdf.detectedTextLength} characters from ${document.fileName}.`,
      documentId: document.documentId,
    });
  }

  return { trace, documents };
}

export async function parseSubmittalDeterministic(
  incomingDocuments: IncomingDocument[],
  options?: Omit<ParserAgentOptions, "mode" | "model">,
): Promise<DetailedParsedSubmittal> {
  const reviewedAt = options?.reviewedAt ?? new Date().toISOString();
  const { trace, documents } = await extractParserDocuments(incomingDocuments);

  const fieldCandidates = [];
  const attributes = [];
  const deviations = [];
  const expectedDocuments = new Set<string>();

  for (const { document, parsedDocument, fullText } of documents) {
    trace.push({
      step: "classify",
      message: `Assigned heuristic document type ${parsedDocument.documentType}.`,
      documentId: document.documentId,
    });

    if (fullText.length === 0) {
      continue;
    }

    const facts = extractDocumentFacts({
      documentId: document.documentId,
      fileName: document.fileName,
      documentType: parsedDocument.documentType,
      text: fullText,
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
    message: "Resolved deterministic document facts into a normalized ParsedSubmittal payload.",
  });

  return composeParsedSubmittal({
    documents: documents.map((item) => item.parsedDocument),
    fieldCandidates,
    attributes,
    deviations,
    expectedDocuments: [...expectedDocuments],
    trace,
    reviewedAt,
  });
}

export async function parseSubmittal(
  incomingDocuments: IncomingDocument[],
  options?: ParserAgentOptions,
): Promise<DetailedParsedSubmittal> {
  const reviewedAt = options?.reviewedAt ?? new Date().toISOString();
  if (options?.mode === "deterministic") {
    return parseSubmittalDeterministic(incomingDocuments, { reviewedAt });
  }

  const { trace, documents } = await extractParserDocuments(incomingDocuments);
  const parsedSubmittal = await runLlmParser({
    documents,
    reviewedAt,
    model: options?.model,
  });

  return {
    ...parsedSubmittal,
    trace: [...trace, ...parsedSubmittal.trace],
  };
}
