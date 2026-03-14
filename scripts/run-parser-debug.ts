import path from "node:path";

import { classifyDocument } from "../src/backend/parsing/classifyDocument";
import { extractDocumentFacts } from "../src/backend/parsing/extractDocumentFacts";
import { extractPdfText } from "../src/backend/parsing/extractPdfText";
import { parseSubmittalDeterministic } from "../src/backend/agents/parser";
import type { IncomingDocument } from "../src/backend/schemas/workflow";

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run parser:debug -- --files test-pdfs/perfect.pdf");
}

function parseCliDocuments(): IncomingDocument[] | null {
  const filesArgIndex = process.argv.findIndex((arg) => arg === "--files");

  if (filesArgIndex === -1) {
    return null;
  }

  const filesValue = process.argv[filesArgIndex + 1];
  if (!filesValue) {
    throw new Error("Missing value for --files");
  }

  return filesValue.split(",").map((filePath, index) => {
    const resolvedPath = path.resolve(filePath.trim());
    return {
      documentId: `debug-${String(index + 1).padStart(2, "0")}`,
      fileName: path.basename(resolvedPath),
      mimeType: "application/pdf",
      filePath: resolvedPath,
    };
  });
}

function shorten(value: string, maxLength = 300): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

async function main(): Promise<void> {
  const documents = parseCliDocuments();
  if (!documents) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  for (const document of documents) {
    const extracted = await extractPdfText(document);
    const documentType = extracted.fullText
      ? classifyDocument(document, extracted.fullText)
      : "unknown";
    const facts = extractDocumentFacts({
      documentId: document.documentId,
      fileName: document.fileName,
      documentType,
      text: extracted.fullText,
    });

    console.log(`=== ${document.fileName} ===`);
    console.log(`classification: ${documentType}`);
    console.log(`chars: ${extracted.detectedTextLength}`);
    console.log(`coverage: ${extracted.textCoverage}`);
    console.log(`pdf issues: ${extracted.issues.length === 0 ? "(none)" : extracted.issues.map((issue) => issue.code).join(", ")}`);
    console.log("");
    console.log("text sample:");
    console.log(shorten(extracted.fullText, 1200));
    console.log("");
    console.log("field candidates:");
    if (facts.fieldCandidates.length === 0) {
      console.log("- (none)");
    } else {
      for (const candidate of facts.fieldCandidates) {
        console.log(
          `- ${candidate.field}: ${candidate.value} | type=${candidate.documentType} | source=${shorten(candidate.sources[0]?.excerpt ?? "", 160)}`,
        );
      }
    }
    console.log("");
    console.log("attributes:");
    if (facts.attributes.length === 0) {
      console.log("- (none)");
    } else {
      for (const attribute of facts.attributes) {
        console.log(`- ${attribute.name}: ${attribute.value}`);
      }
    }
    console.log("");
    console.log(`expected documents: ${facts.expectedDocuments.length === 0 ? "(none)" : facts.expectedDocuments.join(", ")}`);
    console.log(`deviations: ${facts.deviations.length === 0 ? "(none)" : facts.deviations.map((issue) => issue.message).join(" | ")}`);
    console.log("");
  }

  const parsed = await parseSubmittalDeterministic(documents);
  console.log("=== Resolved Output ===");
  console.log(`specSection: ${parsed.specSection.value ?? "(unresolved)"}`);
  console.log(`productType: ${parsed.productType.value ?? "(unresolved)"}`);
  console.log(`manufacturer: ${parsed.manufacturer.value ?? "(unresolved)"}`);
  console.log(`modelNumber: ${parsed.modelNumber.value ?? "(unresolved)"}`);
  console.log(`revision: ${parsed.revision.value ?? "(unresolved)"}`);
  console.log(`missingDocuments: ${parsed.missingDocuments.length === 0 ? "(none)" : parsed.missingDocuments.join(", ")}`);
  console.log(`unresolvedFields: ${parsed.unresolvedFields.length === 0 ? "(none)" : parsed.unresolvedFields.join(", ")}`);
  console.log(`status: ${parsed.parserSummary.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
