import { promises as fs } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { IntakeDocument } from "../schemas/intake";

export type ExtractableFixtureDocument = {
  path: string;
  document: IntakeDocument;
};

export async function extractPdfDocument(
  fixtureRoot: string,
  input: ExtractableFixtureDocument,
): Promise<IntakeDocument> {
  const nextDocument: IntakeDocument = {
    ...input.document,
    warnings: [...(input.document.warnings ?? [])],
  };

  if (nextDocument.extension !== ".pdf") {
    nextDocument.extractionStatus = "skipped";
    return nextDocument;
  }

  const resolvedPath = join(fixtureRoot, input.path);

  try {
    const fileBuffer = await fs.readFile(resolvedPath);
    const loadingTask = getDocument({
      data: new Uint8Array(fileBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      standardFontDataUrl: `${pathToFileURL(
        join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts"),
      ).href}/`,
    });
    const pdf = await loadingTask.promise;

    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ pageNumber, text });
    }

    const fullText = pages.map((page) => page.text).join("\n").trim();

    nextDocument.fullText = fullText;
    nextDocument.extractionStatus = "parsed";

    if (fullText.length === 0) {
      nextDocument.warnings?.push("PDF parsed but no extractable text was found.");
    } else if (fullText.length < 40) {
      nextDocument.warnings?.push("PDF parsed but extracted text is very limited.");
    }

    await loadingTask.destroy();
    return nextDocument;
  } catch (error) {
    nextDocument.extractionStatus = "failed";
    nextDocument.warnings?.push(
      `PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return nextDocument;
  }
}
