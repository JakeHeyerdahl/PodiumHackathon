import assert from "node:assert/strict";

import { loadEnvConfig } from "@next/env";

import { runCompletenessAgent } from "../src/backend/agents/completeness";
import { parseSubmittal } from "../src/backend/agents/parser";
import { buildRequirementSet } from "../src/backend/agents/requirements";
import {
  getMockFixture,
  type MockFixtureName,
} from "../src/backend/demo/mockSubmittals";
import { generateParserFixtures } from "./generate-parser-fixtures";

loadEnvConfig(process.cwd());

type CompletenessEvalExpectation = {
  fixtureName: MockFixtureName;
  expectedStatus?: "complete" | "incomplete" | "needs_human_review";
  acceptableStatuses?: Array<
    "complete" | "incomplete" | "needs_human_review"
  >;
  expectedReviewable: boolean;
  expectedMissingDocuments?: string[];
  expectedAmbiguousDocuments?: string[];
  expectedFlaggedDocuments?: string[];
};

function normalizeDocumentName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, "");
}

function normalizeDocumentNames(values: string[]): string[] {
  return values.map(normalizeDocumentName).sort();
}

const EVAL_CASES: CompletenessEvalExpectation[] = [
  {
    fixtureName: "good-submittal",
    expectedStatus: "complete",
    expectedReviewable: true,
    expectedMissingDocuments: [],
    expectedAmbiguousDocuments: [],
  },
  {
    fixtureName: "missing-doc-submittal",
    expectedStatus: "complete",
    expectedReviewable: true,
    expectedMissingDocuments: [],
    expectedAmbiguousDocuments: [],
  },
  {
    fixtureName: "scan-review-submittal",
    expectedStatus: "needs_human_review",
    expectedReviewable: false,
    expectedMissingDocuments: [],
    expectedAmbiguousDocuments: ["Product Data", "Shop Drawings"],
  },
  {
    fixtureName: "malformed-submittal",
    acceptableStatuses: ["incomplete", "needs_human_review"],
    expectedReviewable: false,
    expectedFlaggedDocuments: ["Product Data", "Shop Drawings"],
  },
];

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

async function evaluateFixture(expectation: CompletenessEvalExpectation) {
  const fixture = getMockFixture(expectation.fixtureName);
  const parsedSubmittal = await parseSubmittal(fixture.documents, {
    mode: "deterministic",
  });
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: fixture.description,
    parsedSubmittal: toRequirementInput(parsedSubmittal),
  });
  const completenessResult = await runCompletenessAgent({
    parsedSubmittal,
    requirementSet,
  });

  assert.equal(
    completenessResult.reviewMode,
    "llm",
    `${expectation.fixtureName}: expected Anthropic LLM mode`,
  );
  if (expectation.acceptableStatuses) {
    assert.ok(
      expectation.acceptableStatuses.includes(completenessResult.status),
      `${expectation.fixtureName}: unexpected completeness status`,
    );
  } else {
    assert.equal(
      completenessResult.status,
      expectation.expectedStatus,
      `${expectation.fixtureName}: unexpected completeness status`,
    );
  }
  assert.equal(
    completenessResult.isReviewable,
    expectation.expectedReviewable,
    `${expectation.fixtureName}: unexpected reviewability`,
  );

  if (expectation.expectedMissingDocuments) {
    assert.deepEqual(
      normalizeDocumentNames(completenessResult.missingDocuments),
      normalizeDocumentNames(expectation.expectedMissingDocuments),
      `${expectation.fixtureName}: unexpected missing documents`,
    );
  }

  if (expectation.expectedAmbiguousDocuments) {
    assert.deepEqual(
      normalizeDocumentNames(completenessResult.ambiguousDocuments),
      normalizeDocumentNames(expectation.expectedAmbiguousDocuments),
      `${expectation.fixtureName}: unexpected ambiguous documents`,
    );
  }

  if (expectation.expectedFlaggedDocuments) {
    const flaggedDocuments = [
      ...completenessResult.missingDocuments,
      ...completenessResult.ambiguousDocuments,
    ];

    assert.deepEqual(
      normalizeDocumentNames(flaggedDocuments),
      normalizeDocumentNames(expectation.expectedFlaggedDocuments),
      `${expectation.fixtureName}: unexpected flagged documents`,
    );
  }

  assert.ok(
    completenessResult.evidence && completenessResult.evidence.length >= 2,
    `${expectation.fixtureName}: expected per-requirement evidence`,
  );

  console.log(
    [
      `PASS ${expectation.fixtureName}`,
      `status=${completenessResult.status}`,
      `reviewable=${String(completenessResult.isReviewable)}`,
      `confidence=${completenessResult.confidence ?? "n/a"}`,
      `model=${completenessResult.model ?? "unknown"}`,
    ].join(" "),
  );
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required to run completeness evals.",
    );
  }

  await generateParserFixtures();

  for (const expectation of EVAL_CASES) {
    await evaluateFixture(expectation);
  }

  console.log(`Completed ${EVAL_CASES.length} completeness evals.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
