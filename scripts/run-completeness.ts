import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { runCompletenessAgent } from "../src/backend/agents/completeness";
import { parseSubmittal } from "../src/backend/agents/parser";
import { buildRequirementSet } from "../src/backend/agents/requirements";
import type { IncomingDocument } from "../src/backend/schemas/workflow";
import { loadLocalEnv } from "./load-local-env";
import { stableJsonStringify } from "./stable-json";

type CliOptions = {
  files?: string;
  projectName: string;
  submittalTitle?: string;
  model?: string;
};

loadEnvConfig(process.cwd());

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run completeness:run -- --files /abs/one.pdf,/abs/two.pdf");
  console.log("Options:");
  console.log("  --project <name>            Project name for requirement reconstruction");
  console.log("  --title <title>             Submittal title override");
  console.log("  --model <model>             Override ANTHROPIC_COMPLETENESS_MODEL");
}

function readOption(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseOptions(): CliOptions {
  return {
    files: readOption("--files"),
    projectName: readOption("--project") ?? "Demo Project",
    submittalTitle: readOption("--title"),
    model: readOption("--model"),
  };
}

function parseCliDocuments(filesValue: string): IncomingDocument[] {
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

function toRequirementInput(parsedSubmittal: Awaited<ReturnType<typeof parseSubmittal>>) {
  return {
    specSection: parsedSubmittal.specSection.value,
    productType: parsedSubmittal.productType.value,
    manufacturer: parsedSubmittal.manufacturer.value,
    modelNumber: parsedSubmittal.modelNumber.value,
    revision: parsedSubmittal.revision.value,
    extractedAttributes: Object.fromEntries(
      parsedSubmittal.extractedAttributes.map((attribute) => [
        attribute.name,
        attribute.value,
      ]),
    ),
    missingDocuments: parsedSubmittal.missingDocuments,
    deviations: parsedSubmittal.deviations.map((issue) => issue.message),
  };
}

async function main(): Promise<void> {
  loadLocalEnv();

  if (hasFlag("--help")) {
    printUsage();
    return;
  }

  const options = parseOptions();
  if (!options.files) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  const documents: IncomingDocument[] = parseCliDocuments(options.files);
  const label = "ad hoc files";
  const submittalTitle = options.submittalTitle ?? "Ad Hoc Submittal";

  const parsedSubmittal = await parseSubmittal(documents, {
    mode: "llm",
  });
  const requirementSet = buildRequirementSet({
    projectName: options.projectName,
    submittalTitle,
    parsedSubmittal: toRequirementInput(parsedSubmittal),
  });

  const completenessResult = await runCompletenessAgent({
    parsedSubmittal,
    requirementSet,
    model: options.model,
  });

  console.log(`Completeness fixture: ${label}`);
  console.log(`Model mode: ${completenessResult.reviewMode ?? "unknown"}`);
  console.log(`Status: ${completenessResult.status}`);
  console.log(`Reviewable: ${completenessResult.isReviewable}`);
  console.log(`Confidence: ${completenessResult.confidence ?? "n/a"}`);
  console.log(stableJsonStringify({
    completenessResult,
    requirementSet,
    parserSummary: parsedSubmittal.parserSummary,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
