import assert from "node:assert/strict";
import test from "node:test";

import {
  runComparisonAgent,
  runTechnicalComparisonAgent,
} from "../src/backend/agents/comparison";
import { MockLlmProvider } from "../src/backend/providers";
import { getComparisonScenario } from "../scripts/comparison-scenarios";

test("comparison agent returns compliant when all required fields match", () => {
  const scenario = getComparisonScenario("compliant");
  const result = runTechnicalComparisonAgent(
    scenario.parsedSubmittal,
    scenario.requirementSet,
  );

  assert.equal(result.status, "compliant");
  assert.equal(result.summary.matchCount, 7);
  assert.equal(result.summary.mismatchCount, 0);
  assert.equal(result.summary.unclearCount, 0);
});

test("comparison agent returns deviation_detected for top-level mismatches", () => {
  const scenario = getComparisonScenario("top-level-mismatch");
  const result = runTechnicalComparisonAgent(
    scenario.parsedSubmittal,
    scenario.requirementSet,
  );

  assert.equal(result.status, "deviation_detected");
  assert(
    result.mismatches.some(
      (item) =>
        item.field === "manufacturer" &&
        item.expected === "Other Manufacturer" &&
        item.actual === "Acme Air Systems",
    ),
  );
});

test("comparison agent returns unclear when a required attribute is missing", () => {
  const scenario = getComparisonScenario("missing-attribute");
  const result = runTechnicalComparisonAgent(
    scenario.parsedSubmittal,
    scenario.requirementSet,
  );

  assert.equal(result.status, "unclear");
  assert(
    result.unclearItems.some(
      (item) =>
        item.field === "airflowCapacity" &&
        item.note === "Submitted evidence is missing for this required attribute.",
    ),
  );
});

test("comparison agent normalizes unordered attribute arrays", () => {
  const scenario = getComparisonScenario("array-match");
  const result = runTechnicalComparisonAgent(
    scenario.parsedSubmittal,
    scenario.requirementSet,
  );

  assert.equal(result.status, "compliant");
  assert.equal(result.summary.matchCount, 1);
});

test("comparison agent treats declared deviations as mismatches", () => {
  const scenario = getComparisonScenario("declared-deviation");
  const result = runTechnicalComparisonAgent(
    scenario.parsedSubmittal,
    scenario.requirementSet,
  );

  assert.equal(result.status, "deviation_detected");
  assert(
    result.mismatches.some(
      (item) =>
        item.field === "declaredDeviation" &&
        item.note === "Parsed submittal includes a declared deviation.",
    ),
  );
});

test("runComparisonAgent returns a structured LLM comparison result", async () => {
  const scenario = getComparisonScenario("compliant");
  const result = await runComparisonAgent({
    parsedSubmittal: scenario.parsedSubmittal,
    requirementSet: scenario.requirementSet,
    llmProvider: new MockLlmProvider({
      objectHandler: () => ({
        status: "compliant",
        matches: [
          {
            field: "manufacturer",
            expected: "Acme Air Systems",
            actual: "Acme Air Systems",
          },
        ],
        mismatches: [],
        unclearItems: [],
        summary: {
          matchCount: 1,
          mismatchCount: 0,
          unclearCount: 0,
        },
      }),
    }),
  });

  assert.equal(result.status, "compliant");
  assert.equal(result.summary.matchCount, 1);
});

test("runComparisonAgent falls back to deterministic comparison when the LLM path fails", async () => {
  const scenario = getComparisonScenario("top-level-mismatch");
  const result = await runComparisonAgent({
    parsedSubmittal: scenario.parsedSubmittal,
    requirementSet: scenario.requirementSet,
    allowDeterministicFallback: true,
    llmProvider: new MockLlmProvider({
      objectHandler: () => {
        throw new Error("Synthetic LLM failure.");
      },
    }),
  });

  assert.equal(result.status, "deviation_detected");
  assert(
    result.mismatches.some((item) => item.field === "manufacturer"),
  );
});

test("runComparisonAgent throws when LLM comparison fails and fallback is disabled", async () => {
  const scenario = getComparisonScenario("compliant");

  await assert.rejects(() =>
    runComparisonAgent({
      parsedSubmittal: scenario.parsedSubmittal,
      requirementSet: scenario.requirementSet,
      allowDeterministicFallback: false,
      llmProvider: new MockLlmProvider({
        objectHandler: () => {
          throw new Error("Synthetic LLM failure.");
        },
      }),
    }),
  );
});
