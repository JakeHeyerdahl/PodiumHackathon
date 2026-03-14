import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { ExtractedPdf, IncomingDocument, ParserIssue } from "../schemas/workflow";

const MIN_TEXT_LENGTH_FOR_SEARCHABLE = 30;

function normalizePageText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function calculateTextCoverage(pageLengths: number[]): number {
  if (pageLengths.length === 0) {
    return 0;
  }

  const pagesWithText = pageLengths.filter((pageLength) => pageLength > 20).length;
  return Number((pagesWithText / pageLengths.length).toFixed(2));
}

export async function extractPdfText(document: IncomingDocument): Promise<ExtractedPdf> {
  const issues: ParserIssue[] = [];

  if (document.mimeType !== "application/pdf") {
    issues.push({
      code: "invalid_mime_type",
      severity: "error",
      message: `Unsupported mime type "${document.mimeType}" for parser v1.`,
      documentId: document.documentId,
    });

    return {
      pageCount: 0,
      pages: [],
      fullText: "",
      textCoverage: 0,
      detectedTextLength: 0,
      issues,
    };
  }

  try {
    const data = await readFile(document.filePath);
    const loadingTask = getDocument({
      data: new Uint8Array(data),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const pages = [];
    const pageLengths: number[] = [];

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const text = normalizePageText(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" "),
      );

      pages.push({
        pageNumber: pageIndex,
        text,
      });
      pageLengths.push(text.length);
    }

    const fullText = normalizePageText(pages.map((page) => page.text).join(" "));
    const detectedTextLength = fullText.length;
    const textCoverage = calculateTextCoverage(pageLengths);

    if (detectedTextLength === 0) {
      issues.push({
        code: "empty_text",
        severity: "error",
        message: "The PDF did not yield any searchable text.",
        documentId: document.documentId,
      });
    } else if (
      detectedTextLength < MIN_TEXT_LENGTH_FOR_SEARCHABLE ||
      textCoverage < 0.5
    ) {
      issues.push({
        code: "ocr_required",
        severity: "warning",
        message: "The PDF appears to have too little searchable text and likely needs OCR.",
        documentId: document.documentId,
      });
    }

    await loadingTask.destroy();

    return {
      pageCount: pdf.numPages,
      pages,
      fullText,
      textCoverage,
      detectedTextLength,
      issues,
    };
  } catch (error) {
    issues.push({
      code: "pdf_load_failed",
      severity: "error",
      message: error instanceof Error ? error.message : "Unknown PDF load failure.",
      documentId: document.documentId,
    });

    return {
      pageCount: 0,
      pages: [],
      fullText: "",
      textCoverage: 0,
      detectedTextLength: 0,
      issues,
    };
  }
}
