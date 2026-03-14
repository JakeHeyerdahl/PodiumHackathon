import {
  getComparisonScenario,
  listComparisonScenarios,
  type ComparisonScenarioName,
} from "./comparison-scenarios";
import { loadLocalEnv } from "./load-local-env";
import { stableJsonStringify } from "./stable-json";
import { runComparisonAgent } from "../src/backend/agents/comparison";

loadLocalEnv();

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run comparison:run -- <scenario-name>");
  console.log("  npm run comparison:run -- <scenario-name> --provider mock");
  console.log(`Scenarios: ${listComparisonScenarios().join(", ")}`);
}

function readOption(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const scenarioName = process.argv[2] as ComparisonScenarioName | undefined;

  if (!scenarioName || !listComparisonScenarios().includes(scenarioName)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const scenario = getComparisonScenario(scenarioName);
  const provider = readOption("--provider");
  const model = readOption("--model");
  const comparisonResult = await runComparisonAgent({
    parsedSubmittal: scenario.parsedSubmittal,
    requirementSet: scenario.requirementSet,
    provider:
      provider === "anthropic" || provider === "mock" ? provider : undefined,
    model,
  });

  console.log(`Comparison scenario: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log("Mode: llm");
  console.log(`Status: ${comparisonResult.status}`);
  console.log(
    `Summary: ${comparisonResult.summary.matchCount} match(es), ${comparisonResult.summary.mismatchCount} mismatch(es), ${comparisonResult.summary.unclearCount} unclear item(s)`,
  );
  console.log(
    stableJsonStringify({
      scenario,
      comparisonResult,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
