import path from "node:path";

import { runRealPdfEvaluation } from "../src/backend/evals/runRealPdfEvaluation";
import { stableJsonStringify } from "./stable-json";

function readOption(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run pdf:eval -- --submittal /abs/one.pdf,/abs/two.pdf");
  console.log("Options:");
  console.log("  --requirements /abs/requirement.pdf");
  console.log("  --provider anthropic|mock");
  console.log("  --parser-model <model>");
  console.log("  --requirements-model <model>");
  console.log("  --comparison-model <model>");
}

async function main(): Promise<void> {
  const submittalValue = readOption("--submittal");
  if (!submittalValue) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const requirementFile =
    readOption("--requirements") ??
    path.resolve(process.cwd(), "test-pdfs/requirement-1.pdf");
  const provider = readOption("--provider");

  const result = await runRealPdfEvaluation({
    submittalFiles: submittalValue.split(",").map((file) => file.trim()),
    requirementFile,
    provider:
      provider === "anthropic" || provider === "mock" ? provider : undefined,
    parserModel: readOption("--parser-model"),
    requirementModel: readOption("--requirements-model"),
    comparisonModel: readOption("--comparison-model"),
    allowMockFallback: hasFlag("--allow-mock-fallback"),
  });

  console.log(stableJsonStringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
