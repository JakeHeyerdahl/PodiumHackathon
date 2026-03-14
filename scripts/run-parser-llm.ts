import path from "node:path";

import { parseSubmittal } from "../src/backend/agents/parser";
import type { IncomingDocument } from "../src/backend/schemas/workflow";
import { loadLocalEnv } from "./load-local-env";
import { stableJsonStringify } from "./stable-json";

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run parser:run:llm -- --files /abs/one.pdf,/abs/two.pdf");
  console.log("  npm run parser:run:llm -- --files /abs/one.pdf --model claude-sonnet-4-5-20250929");
}

function requireApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for parser:run:llm.");
  }
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

function parseModelArg(): string | undefined {
  const modelArgIndex = process.argv.findIndex((arg) => arg === "--model");

  if (modelArgIndex === -1) {
    return undefined;
  }

  const model = process.argv[modelArgIndex + 1];
  if (!model) {
    throw new Error("Missing value for --model");
  }

  return model;
}

async function runFixture(
  label: string,
  documents: IncomingDocument[],
  model?: string,
): Promise<void> {
  const parsedSubmittal = await parseSubmittal(documents, { model });
  console.log(`Parser fixture: ${label}`);
  console.log(`Status: ${parsedSubmittal.parserSummary.status}`);
  console.log(`Documents: ${parsedSubmittal.parserSummary.parsedDocumentCount}`);
  console.log(`Warnings: ${parsedSubmittal.parserSummary.warningCount}`);
  console.log(`Errors: ${parsedSubmittal.parserSummary.errorCount}`);
  console.log(stableJsonStringify(parsedSubmittal));
}

async function main(): Promise<void> {
  loadLocalEnv();
  requireApiKey();
  const model = parseModelArg();
  const cliDocuments = parseCliDocuments();
  if (!cliDocuments) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  await runFixture("ad hoc files", cliDocuments, model);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
