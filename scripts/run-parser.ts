import path from "node:path";

import { parseSubmittalDeterministic } from "../src/backend/agents/parser";
import {
  getMockFixture,
  listMockFixtures,
  type MockFixtureName,
} from "../src/backend/demo/mockSubmittals";
import type { IncomingDocument } from "../src/backend/schemas/workflow";
import { generateParserFixtures } from "./generate-parser-fixtures";
import { stableJsonStringify } from "./stable-json";

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run parser:run -- <fixture-name>");
  console.log("  npm run parser:run -- --files /abs/one.pdf,/abs/two.pdf");
  console.log(`Fixtures: ${listMockFixtures().join(", ")}`);
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
  await generateParserFixtures();

  const cliDocuments = parseCliDocuments();
  let documents: IncomingDocument[];
  let label: string;

  if (cliDocuments) {
    documents = cliDocuments;
    label = "ad hoc files";
  } else {
    const fixtureName = process.argv[2] as MockFixtureName | undefined;
    if (!fixtureName || !listMockFixtures().includes(fixtureName)) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    const fixture = getMockFixture(fixtureName);
    documents = fixture.documents;
    label = fixture.name;
  }

  const parsedSubmittal = await parseSubmittalDeterministic(documents);
  console.log(`Parser fixture: ${label}`);
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
