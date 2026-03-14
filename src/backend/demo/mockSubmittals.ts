import path from "node:path";

import type { IncomingDocument } from "../schemas/workflow";

export type MockFixtureName =
  | "good-submittal"
  | "missing-doc-submittal"
  | "deviation-submittal"
  | "conflict-submittal"
  | "scan-review-submittal"
  | "malformed-submittal";

export type MockFixture = {
  name: MockFixtureName;
  description: string;
  documents: IncomingDocument[];
  expectedSnapshotPath: string;
};

const fixtureRoot = path.resolve(process.cwd(), "scripts/fixtures/generated");
const expectedRoot = path.resolve(process.cwd(), "scripts/fixtures/expected");

function pdfDocument(
  fixture: MockFixtureName,
  documentId: string,
  fileName: string,
): IncomingDocument {
  return {
    documentId,
    fileName,
    mimeType: "application/pdf",
    filePath: path.join(fixtureRoot, fixture, fileName),
  };
}

export function getMockFixture(name: MockFixtureName): MockFixture {
  const expectedSnapshotPath = path.join(expectedRoot, `${name}.json`);

  switch (name) {
    case "good-submittal":
      return {
        name,
        description: "Complete searchable submittal with deterministic extracted facts.",
        expectedSnapshotPath,
        documents: [
          pdfDocument(name, "01-cover", "01-submittal-cover.pdf"),
          pdfDocument(name, "02-product", "02-product-data.pdf"),
          pdfDocument(name, "03-drawing", "03-shop-drawing.pdf"),
          pdfDocument(name, "04-warranty", "04-warranty.pdf"),
          pdfDocument(name, "05-manual", "05-operations-manual.pdf"),
        ],
      };
    case "missing-doc-submittal":
      return {
        name,
        description: "Searchable submittal with a missing warranty document.",
        expectedSnapshotPath,
        documents: [
          pdfDocument(name, "01-cover", "01-submittal-cover.pdf"),
          pdfDocument(name, "02-product", "02-product-data.pdf"),
          pdfDocument(name, "03-drawing", "03-shop-drawing.pdf"),
          pdfDocument(name, "04-manual", "04-operations-manual.pdf"),
        ],
      };
    case "deviation-submittal":
      return {
        name,
        description: "Submittal with an explicit substitution/deviation letter.",
        expectedSnapshotPath,
        documents: [
          pdfDocument(name, "01-cover", "01-submittal-cover.pdf"),
          pdfDocument(name, "02-product", "02-product-data.pdf"),
          pdfDocument(name, "03-deviation", "03-deviation-letter.pdf"),
        ],
      };
    case "conflict-submittal":
      return {
        name,
        description: "Submittal with conflicting model and revision values across documents.",
        expectedSnapshotPath,
        documents: [
          pdfDocument(name, "01-cover", "01-submittal-cover.pdf"),
          pdfDocument(name, "02-product", "02-product-data.pdf"),
          pdfDocument(name, "03-drawing", "03-shop-drawing.pdf"),
        ],
      };
    case "scan-review-submittal":
      return {
        name,
        description: "Package that contains a low-text PDF that should be flagged for OCR review.",
        expectedSnapshotPath,
        documents: [
          pdfDocument(name, "01-cover", "01-submittal-cover.pdf"),
          pdfDocument(name, "02-product", "02-low-text-scan.pdf"),
        ],
      };
    case "malformed-submittal":
      return {
        name,
        description: "Package that includes an invalid PDF file.",
        expectedSnapshotPath,
        documents: [
          pdfDocument(name, "01-cover", "01-submittal-cover.pdf"),
          pdfDocument(name, "02-badfile", "02-corrupted.pdf"),
        ],
      };
  }
}

export function listMockFixtures(): MockFixtureName[] {
  return [
    "good-submittal",
    "missing-doc-submittal",
    "deviation-submittal",
    "conflict-submittal",
    "scan-review-submittal",
    "malformed-submittal",
  ];
}
