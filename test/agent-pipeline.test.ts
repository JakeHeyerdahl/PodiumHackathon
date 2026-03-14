import assert from "node:assert/strict";
import test, { before } from "node:test";

import { runTechnicalComparisonAgent } from "../src/backend/agents/comparison";
import { runCompletenessAgent } from "../src/backend/agents/completeness";
import {
  applyExecutiveDecisionToWorkflowState,
  runExecutiveAgent,
} from "../src/backend/agents/executive";
import { parseSubmittalDeterministic } from "../src/backend/agents/parser";
import { buildRequirementSet } from "../src/backend/agents/requirements";
import { determineRoutingDecision } from "../src/backend/agents/routing";
import { getMockFixture } from "../src/backend/demo/mockSubmittals";
import type {
  ComparisonResult as WorkflowComparisonResult,
  DetailedParsedSubmittal,
  WorkflowState,
} from "../src/backend/schemas/workflow";
import { generateParserFixtures } from "../scripts/generate-parser-fixtures";

before(async () => {
  await generateParserFixtures();
});

function toRequirementInput(parsedSubmittal: DetailedParsedSubmittal) {
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

function toWorkflowScalar(
  value:
    | string
    | number
    | boolean
    | Array<string | number | boolean>
    | null
    | undefined,
): string | number | boolean | null {
  if (Array.isArray(value)) {
    return value.length === 0 ? null : String(value[0]);
  }

  return value ?? null;
}

function toWorkflowComparisonResult(
  comparisonResult: ReturnType<typeof runTechnicalComparisonAgent>,
): WorkflowComparisonResult {
  return {
    status: comparisonResult.status,
    matches: comparisonResult.matches.map((item) => ({
      field: item.field,
      expected: toWorkflowScalar(item.expected),
      actual: toWorkflowScalar(item.actual),
      note: item.note,
    })),
    mismatches: comparisonResult.mismatches.map((item) => ({
      field: item.field,
      expected: toWorkflowScalar(item.expected),
      actual: toWorkflowScalar(item.actual),
      note: item.note,
    })),
    unclearItems: comparisonResult.unclearItems.map((item) => ({
      field: item.field,
      expected: toWorkflowScalar(item.expected),
      actual: toWorkflowScalar(item.actual),
      note: item.note,
    })),
    summary: comparisonResult.summary,
  };
}

function createWorkflowState(): WorkflowState {
  return {
    runId: "run-001",
    projectName: "Demo Project",
    submittalTitle: "Packaged Indoor Air Handling Unit",
    currentStatus: "ready_for_executive_review",
    incomingDocuments: [],
    logs: [],
  };
}

test("requirements reconstruction anchors spec section and seeds deterministic expectations", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: "Packaged Indoor Air Handling Unit",
    parsedSubmittal: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      revision: "B",
      extractedAttributes: {
        airflow: "12000 CFM",
      },
      missingDocuments: [],
      deviations: [],
    },
  });

  assert.equal(requirementSet.specSection.value, "23 73 13");
  assert.equal(requirementSet.routingPolicy.completeDestination, "auto_route_internal_review");
  assert(
    requirementSet.requiredAttributes.some(
      (attribute) =>
        attribute.key === "manufacturer" &&
        attribute.expectedValue === "Acme Air Systems",
    ),
  );
  assert(
    requirementSet.requiredDocuments.some(
      (document) => document.key === "product data" || document.key === "product_data",
    ),
  );
});

test("completeness agent falls back deterministically when the LLM path is unavailable", async () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: "Custom completeness fallback test",
    parsedSubmittal: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      revision: "B",
      extractedAttributes: {},
      missingDocuments: [],
      deviations: [],
    },
  });

  const completenessResult = await runCompletenessAgent({
    parsedSubmittal: {
      specSection: { value: "23 73 13", confidence: "high", sources: [] },
      productType: {
        value: "Packaged Indoor Air Handling Unit",
        confidence: "high",
        sources: [],
      },
      manufacturer: { value: "Acme Air Systems", confidence: "high", sources: [] },
      modelNumber: { value: "AHU-9000", confidence: "high", sources: [] },
      revision: { value: "B", confidence: "high", sources: [] },
      extractedAttributes: [],
      missingDocuments: ["Shop Drawings"],
      deviations: [],
      documentParses: [
        {
          documentId: "doc-01",
          fileName: "product-data.pdf",
          documentType: "product_data",
          extractionStatus: "parsed",
          textCoverage: 0.98,
          detectedTextLength: 1200,
          issues: [],
        },
      ],
      unresolvedFields: [],
      parserSummary: {
        status: "parsed",
        parsedDocumentCount: 1,
        warningCount: 0,
        errorCount: 0,
        reviewedAt: "2026-01-01T00:00:00.000Z",
      },
      issues: [],
      trace: [],
    },
    requirementSet,
    allowDeterministicFallback: true,
  });

  assert.equal(completenessResult.reviewMode, "deterministic_fallback");
  assert.equal(completenessResult.status, "incomplete");
  assert.equal(completenessResult.isReviewable, false);
  assert(completenessResult.missingDocuments.includes("Shop Drawings"));
});

test("good fixture can move through parser, requirements, and completeness deterministically", async () => {
  const fixture = getMockFixture("good-submittal");
  const parsedSubmittal = await parseSubmittalDeterministic(fixture.documents, {
    reviewedAt: "2026-01-01T00:00:00.000Z",
  });
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: fixture.description,
    parsedSubmittal: toRequirementInput(parsedSubmittal),
  });
  const completenessResult = await runCompletenessAgent({
    parsedSubmittal,
    requirementSet,
    allowDeterministicFallback: true,
  });

  assert.equal(completenessResult.status, "complete");
  assert.equal(parsedSubmittal.parserSummary.status, "parsed");
  assert.equal(requirementSet.specSection.value, "23 73 13");
  assert.equal(
    requirementSet.routingPolicy.completeDestination,
    "auto_route_internal_review",
  );
});

test("compliant decisioning path routes and approves a clean package", () => {
  const comparisonResult = toWorkflowComparisonResult(
    runTechnicalComparisonAgent(
      {
        specSection: "23 73 13",
        manufacturer: "Acme Air Systems",
        modelNumber: "AHU-9000",
        deviations: [],
      },
      {
        specSection: "23 73 13",
        manufacturer: "Acme Air Systems",
        modelNumber: "AHU-9000",
      },
    ),
  );
  const completenessResult = {
    status: "complete" as const,
    isReviewable: true,
    missingDocuments: [],
    ambiguousDocuments: [],
    rationale: {
      summary: "All required documents are present.",
      facts: ["No mandatory documents were missing."],
    },
  };
  const routingDecision = determineRoutingDecision({
    completenessResult,
    comparisonResult,
    routingPolicy: "auto_route_internal_review",
  });
  const executiveResult = runExecutiveAgent({
    ...createWorkflowState(),
    parsedSubmittal: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      submittedDocuments: [],
      missingDocuments: [],
      deviations: [],
    },
    requirementSet: {
      specSection: "23 73 13",
      requiredAttributes: ["manufacturer", "modelNumber"],
      requiredDocuments: [],
      routingPolicy: "auto_route_internal_review",
    },
    completenessResult,
    comparisonResult,
    routingDecision,
  });

  assert.equal(comparisonResult.status, "compliant");
  assert.equal(routingDecision.destination, "auto_route_internal_review");
  assert.equal(executiveResult.executiveDecision.decision, "approve_internal_progression");

  const updatedState = applyExecutiveDecisionToWorkflowState(
    createWorkflowState(),
    executiveResult,
  );
  assert.equal(
    updatedState.currentStatus,
    "executive_approved_internal_progression",
  );
});

test("deviation evidence is escalated instead of auto-approved", () => {
  const comparisonResult = toWorkflowComparisonResult(
    runTechnicalComparisonAgent(
      {
        specSection: "23 73 13",
        manufacturer: "Acme Air Systems",
        modelNumber: "AHU-9000",
        deviations: ["Substitution proposed for scheduled basis-of-design unit."],
      },
      {
        specSection: "23 73 13",
        manufacturer: "Acme Air Systems",
        modelNumber: "AHU-9000",
      },
    ),
  );
  const completenessResult = {
    status: "complete" as const,
    isReviewable: true,
    missingDocuments: [],
    ambiguousDocuments: [],
    rationale: {
      summary: "All required documents are present.",
      facts: ["No mandatory documents were missing."],
    },
  };
  const routingDecision = determineRoutingDecision({
    completenessResult,
    comparisonResult,
    routingPolicy: "human_exception_queue",
  });
  const executiveResult = runExecutiveAgent({
    ...createWorkflowState(),
    parsedSubmittal: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      submittedDocuments: [],
      missingDocuments: [],
      deviations: ["Substitution proposed for scheduled basis-of-design unit."],
    },
    requirementSet: {
      specSection: "23 73 13",
      requiredAttributes: ["manufacturer", "modelNumber"],
      requiredDocuments: [],
      routingPolicy: "human_exception_queue",
    },
    completenessResult,
    comparisonResult,
    routingDecision,
  });

  assert.equal(comparisonResult.status, "deviation_detected");
  assert.equal(routingDecision.destination, "human_exception_queue");
  assert.equal(executiveResult.executiveDecision.decision, "escalate_to_human");
});
