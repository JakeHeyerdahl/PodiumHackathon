import path from "node:path";

import { parseSubmittal, parseSubmittalDeterministic } from "../src/backend/agents/parser";
import type { IncomingDocument } from "../src/backend/schemas/workflow";
import { stableJsonStringify } from "./stable-json";

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run parser:run -- --files /abs/one.pdf,/abs/two.pdf");
  console.log("  npm run parser:run -- --files /abs/one.pdf --deterministic");
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
      documentId: `cli-${String(index + 1).padStart(2, "0")}`,
      fileName: path.basename(resolvedPath),
      mimeType: "application/pdf",
      filePath: resolvedPath,
    };
  });
}

async function main(): Promise<void> {
  const deterministic = process.argv.includes("--deterministic");

  const cliDocuments = parseCliDocuments();
  if (!cliDocuments) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  const documents: IncomingDocument[] = cliDocuments;
  const label = "ad hoc files";

  const parsedSubmittal = deterministic
    ? await parseSubmittalDeterministic(documents)
    : await parseSubmittal(documents, {
        mode: "llm",
        allowDeterministicFallback: true,
      });
  console.log(`Parser fixture: ${label}`);
  console.log(`Mode: ${deterministic ? "deterministic" : "llm"}`);
  console.log(`Status: ${parsedSubmittal.parserSummary.status}`);
  console.log(`Documents: ${parsedSubmittal.parserSummary.parsedDocumentCount}`);
  console.log(`Warnings: ${parsedSubmittal.parserSummary.warningCount}`);
  console.log(`Errors: ${parsedSubmittal.parserSummary.errorCount}`);
  console.log(stableJsonStringify(parsedSubmittal));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
