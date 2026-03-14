import assert from "node:assert/strict";
import test from "node:test";

import { runTechnicalComparisonAgent } from "../src/backend/agents/comparison";
import { runCompletenessAgent } from "../src/backend/agents/completeness";
import {
  applyExecutiveDecisionToWorkflowState,
  runExecutiveAgent,
} from "../src/backend/agents/executive";
import { parseSubmittalDeterministic } from "../src/backend/agents/parser";
import { buildRequirementSet } from "../src/backend/agents/requirements";
import { determineRoutingDecision } from "../src/backend/agents/routing";
import { getRealSubmittalFixture } from "../src/backend/demo/realPdfFixtures";
import type {
  ComparisonResult as WorkflowComparisonResult,
  DetailedParsedSubmittal,
  WorkflowState,
} from "../src/backend/schemas/workflow";

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
    submittalTitle: "Real PDF Debugging",
    currentStatus: "ready_for_executive_review",
    incomingDocuments: [],
    logs: [],
  };
}

test("requirements reconstruction anchors spec section and seeds deterministic expectations", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: "AHU Product Data",
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

test("completeness agent throws when the LLM path is unavailable", async () => {
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

  await assert.rejects(() =>
    runCompletenessAgent({
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
    }),
  );
});

test("perfect.pdf now reconstructs requirements around the CMU row", async () => {
  const fixture = getRealSubmittalFixture("perfect");
  const parsedSubmittal = await parseSubmittalDeterministic([fixture.document], {
    reviewedAt: "2026-01-01T00:00:00.000Z",
  });
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: fixture.description,
    parsedSubmittal: toRequirementInput(parsedSubmittal),
  });

  assert.equal(parsedSubmittal.parserSummary.status, "parsed_with_warnings");
  assert.equal(requirementSet.specSection.value, "04 21 00");
  assert.equal(
    requirementSet.requiredAttributes.find((attribute) => attribute.key === "manufacturer")
      ?.expectedValue,
    "Acme Block Co.",
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
  assert.equal(
    applyExecutiveDecisionToWorkflowState(createWorkflowState(), executiveResult).currentStatus,
    "executive_approved_internal_progression",
  );
});
