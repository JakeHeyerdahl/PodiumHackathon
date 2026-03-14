import assert from "node:assert/strict";
import test from "node:test";

import {
  determineRoutingDecision,
  runRoutingAgent,
} from "../src/backend/agents/routing";
import { MockLlmProvider } from "../src/backend/providers";
import type {
  ComparisonResult,
  CompletenessResult,
} from "../src/backend/schemas/workflow";

function createCompletenessResult(
  overrides: Partial<CompletenessResult> = {},
): CompletenessResult {
  return {
    status: "complete",
    isReviewable: true,
    missingDocuments: [],
    ambiguousDocuments: [],
    rationale: {
      summary: "Complete package.",
      facts: ["All required documents are present."],
    },
    ...overrides,
  };
}

function createComparisonResult(
  overrides: Partial<ComparisonResult> = {},
): ComparisonResult {
  return {
    status: "compliant",
    matches: [],
    mismatches: [],
    unclearItems: [],
    summary: {
      matchCount: 0,
      mismatchCount: 0,
      unclearCount: 0,
    },
    ...overrides,
  };
}

test("routing returns incomplete packages to the subcontractor by default", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult({
      status: "incomplete",
      isReviewable: false,
      missingDocuments: ["Warranty"],
    }),
    comparisonResult: createComparisonResult(),
    routingPolicy: "auto_route_internal_review",
  });

  assert.equal(decision.destination, "return_to_subcontractor");
  assert.match(decision.rationale, /incomplete/i);
});

test("routing honors object policy destination for incomplete packages", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult({
      status: "incomplete",
      isReviewable: false,
      missingDocuments: ["Warranty"],
    }),
    comparisonResult: createComparisonResult(),
    routingPolicy: {
      missingDocumentDestination: "human_exception_queue",
      completeDestination: "auto_route_internal_review",
      deviationDestination: "human_exception_queue",
    },
  });

  assert.equal(decision.destination, "human_exception_queue");
});

test("routing sends completeness human review cases to the policy deviation destination", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult({
      status: "needs_human_review",
      ambiguousDocuments: ["Shop Drawings"],
    }),
    comparisonResult: createComparisonResult(),
    routingPolicy: {
      deviationDestination: "return_to_subcontractor",
    },
  });

  assert.equal(decision.destination, "return_to_subcontractor");
});

test("routing sends detected deviations to the policy deviation destination", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult(),
    comparisonResult: createComparisonResult({
      status: "deviation_detected",
      mismatches: [
        {
          field: "manufacturer",
          expected: "Other Manufacturer",
          actual: "Acme Air Systems",
        },
      ],
      summary: {
        matchCount: 0,
        mismatchCount: 1,
        unclearCount: 0,
      },
    }),
    routingPolicy: {
      deviationDestination: "human_exception_queue",
    },
  });

  assert.equal(decision.destination, "human_exception_queue");
});

test("routing sends unclear comparison results to the policy deviation destination", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult(),
    comparisonResult: createComparisonResult({
      status: "unclear",
      unclearItems: [
        {
          field: "airflowCapacity",
          expected: "12000 CFM",
          actual: null,
          note: "Missing evidence.",
        },
      ],
      summary: {
        matchCount: 0,
        mismatchCount: 0,
        unclearCount: 1,
      },
    }),
    routingPolicy: {
      deviationDestination: "return_to_subcontractor",
    },
  });

  assert.equal(decision.destination, "return_to_subcontractor");
});

test("routing honors object policy complete destination for clean packages", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult(),
    comparisonResult: createComparisonResult(),
    routingPolicy: {
      completeDestination: "human_exception_queue",
      rationale: "Project policy requires manual sign-off for all complete packages.",
    },
  });

  assert.equal(decision.destination, "human_exception_queue");
  assert.match(decision.rationale, /manual sign-off/i);
});

test("routing still supports legacy string policies with whitespace and case differences", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult(),
    comparisonResult: createComparisonResult(),
    routingPolicy: "  AUTO_ROUTE_INTERNAL_REVIEW  ",
  });

  assert.equal(decision.destination, "auto_route_internal_review");
});

test("routing treats legacy human-readable string policies as human review", () => {
  const decision = determineRoutingDecision({
    completenessResult: createCompletenessResult(),
    comparisonResult: createComparisonResult({
      status: "deviation_detected",
      mismatches: [
        {
          field: "manufacturer",
          expected: "Other Manufacturer",
          actual: "Acme Air Systems",
        },
      ],
      summary: {
        matchCount: 0,
        mismatchCount: 1,
        unclearCount: 0,
      },
    }),
    routingPolicy: "Manual exception review required",
  });

  assert.equal(decision.destination, "human_exception_queue");
});

test("runRoutingAgent returns a structured LLM routing decision", async () => {
  const decision = await runRoutingAgent({
    completenessResult: createCompletenessResult(),
    comparisonResult: createComparisonResult(),
    routingPolicy: {
      completeDestination: "auto_route_internal_review",
    },
    llmProvider: new MockLlmProvider({
      objectHandler: () => ({
        destination: "auto_route_internal_review",
        actions: [
          "Advance the package to internal review.",
          "Attach the compliance summary.",
        ],
        rationale: "LLM confirmed that the package is complete and compliant.",
      }),
    }),
  });

  assert.equal(decision.destination, "auto_route_internal_review");
  assert.match(decision.rationale, /llm confirmed/i);
});

test("runRoutingAgent falls back to deterministic routing when the LLM path fails", async () => {
  const decision = await runRoutingAgent({
    completenessResult: createCompletenessResult({
      status: "incomplete",
      isReviewable: false,
      missingDocuments: ["Warranty"],
    }),
    comparisonResult: createComparisonResult(),
    routingPolicy: {
      missingDocumentDestination: "return_to_subcontractor",
    },
    allowDeterministicFallback: true,
    llmProvider: new MockLlmProvider({
      objectHandler: () => {
        throw new Error("Synthetic LLM failure.");
      },
    }),
  });

  assert.equal(decision.destination, "return_to_subcontractor");
});

test("runRoutingAgent throws when LLM routing fails and fallback is disabled", async () => {
  await assert.rejects(() =>
    runRoutingAgent({
      completenessResult: createCompletenessResult(),
      comparisonResult: createComparisonResult(),
      routingPolicy: "auto_route_internal_review",
      allowDeterministicFallback: false,
      llmProvider: new MockLlmProvider({
        objectHandler: () => {
          throw new Error("Synthetic LLM failure.");
        },
      }),
    }),
  );
});
