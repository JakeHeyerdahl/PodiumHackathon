import path from "node:path";

import type { IncomingDocument } from "../schemas/workflow";
import type { UploadIntakePayload } from "../schemas/intake";

export type RealSubmittalFixtureName = "perfect" | "submittal-1" | "busted";

export type RealSubmittalFixture = {
  name: RealSubmittalFixtureName;
  description: string;
  document: IncomingDocument;
  intakePayload: UploadIntakePayload;
};

function testPdfPath(fileName: string): string {
  return path.resolve(process.cwd(), "test-pdfs", fileName);
}

function intakePayload(fileName: string): UploadIntakePayload {
  return {
    projectName: "Local Intake Test",
    sourceType: "upload",
    documents: [
      {
        fileName,
        path: fileName,
        mimeType: "application/pdf",
      },
    ],
  };
}

function pdfDocument(fileName: string): IncomingDocument {
  return {
    documentId: fileName.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    fileName,
    mimeType: "application/pdf",
    filePath: testPdfPath(fileName),
  };
}

export function getRealSubmittalFixture(
  name: RealSubmittalFixtureName,
): RealSubmittalFixture {
  switch (name) {
    case "perfect":
      return {
        name,
        description:
          "Comprehensive masonry submittal package in a single PDF with multiple material items.",
        document: pdfDocument("perfect.pdf"),
        intakePayload: intakePayload("perfect.pdf"),
      };
    case "submittal-1":
      return {
        name,
        description:
          "Single submittal PDF with partial masonry content and weaker field extraction signals.",
        document: pdfDocument("submittal-1.pdf"),
        intakePayload: intakePayload("submittal-1.pdf"),
      };
    case "busted":
      return {
        name,
        description:
          "Problematic submittal PDF that currently fails to classify and extract enough structure.",
        document: pdfDocument("busted.pdf"),
        intakePayload: intakePayload("busted.pdf"),
      };
  }
}

export function listRealSubmittalFixtures(): RealSubmittalFixtureName[] {
  return ["perfect", "submittal-1", "busted"];
}

export function getRequirementDocument(): IncomingDocument {
  return {
    documentId: "requirement-01",
    fileName: "requirement-1.pdf",
    mimeType: "application/pdf",
    filePath: testPdfPath("requirement-1.pdf"),
  };
}
