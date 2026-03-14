import assert from "node:assert/strict";
import path from "node:path";
import test, { before } from "node:test";

import { runSubmittalWorkflow } from "../src/backend/orchestrator/runWorkflow";
import { getRealSubmittalFixture } from "../src/backend/demo/realPdfFixtures";
import { loadLocalEnv } from "../scripts/load-local-env";

const testPdfRoot = path.resolve(process.cwd(), "test-pdfs");

before(() => {
  loadLocalEnv();
});

test("perfect.pdf now keeps the parser anchored on the CMU row even though the package still returns for missing shop drawings", async () => {
  const fixture = getRealSubmittalFixture("perfect");
  const result = await runSubmittalWorkflow(fixture.intakePayload, {
    fixtureRoot: testPdfRoot,
    reviewedAt: "2026-03-14T12:00:00.000Z",
    parserModel: process.env.ANTHROPIC_MODEL,
    completenessModel: process.env.ANTHROPIC_COMPLETENESS_MODEL,
    comparisonModel: process.env.ANTHROPIC_COMPARISON_MODEL,
    routingModel: process.env.ANTHROPIC_ROUTING_MODEL,
  });

  assert.equal(result.intakeResult.status, "accepted");
  assert.equal(
    result.workflowState.parsedSubmittal?.productType,
    "Concrete Masonry Units (CMU)",
  );
  assert.equal(result.workflowState.parsedSubmittal?.manufacturer, "Acme Block Co.");
  assert.equal(result.workflowState.completenessResult?.status, "incomplete");
  assert.equal(
    result.workflowState.routingDecision?.destination,
    "return_to_subcontractor",
  );
  assert.equal(
    result.workflowState.executiveDecision?.decision,
    "return_to_subcontractor",
  );
  assert(
    result.workflowState.executiveDecision?.nextActions.includes(
      "Contact the subcontractor with the return notice and required corrections.",
    ),
  );
});

test("submittal-1.pdf now resolves the CMU row before completeness returns it for missing shop drawings", async () => {
  const fixture = getRealSubmittalFixture("submittal-1");
  const result = await runSubmittalWorkflow(fixture.intakePayload, {
    fixtureRoot: testPdfRoot,
    reviewedAt: "2026-03-14T12:00:00.000Z",
    parserModel: process.env.ANTHROPIC_MODEL,
    completenessModel: process.env.ANTHROPIC_COMPLETENESS_MODEL,
    comparisonModel: process.env.ANTHROPIC_COMPARISON_MODEL,
    routingModel: process.env.ANTHROPIC_ROUTING_MODEL,
  });

  assert.equal(result.intakeResult.status, "accepted");
  assert.equal(result.workflowState.parsedSubmittal?.specSection, "04 21 00");
  assert.equal(
    result.workflowState.parsedSubmittal?.productType,
    "Concrete Masonry Units (CMU)",
  );
  assert.equal(result.workflowState.parsedSubmittal?.manufacturer, "Acme Block Co.");
  assert.equal(result.workflowState.completenessResult?.status, "incomplete");
  assert.equal(
    result.workflowState.routingDecision?.destination,
    "return_to_subcontractor",
  );
  assert.equal(
    result.workflowState.executiveDecision?.decision,
    "return_to_subcontractor",
  );
  assert(
    result.workflowState.executiveDecision?.nextActions.includes(
      "Contact the subcontractor with the return notice and required corrections.",
    ),
  );
});

test("busted.pdf currently returns because the parser cannot resolve a reviewable package", async () => {
  const fixture = getRealSubmittalFixture("busted");
  const result = await runSubmittalWorkflow(fixture.intakePayload, {
    fixtureRoot: testPdfRoot,
    reviewedAt: "2026-03-14T12:00:00.000Z",
    parserModel: process.env.ANTHROPIC_MODEL,
    completenessModel: process.env.ANTHROPIC_COMPLETENESS_MODEL,
    comparisonModel: process.env.ANTHROPIC_COMPARISON_MODEL,
    routingModel: process.env.ANTHROPIC_ROUTING_MODEL,
  });

  assert.equal(result.intakeResult.status, "accepted");
  assert.equal(result.workflowState.parsedSubmittal?.specSection, "");
  assert.equal(result.workflowState.parsedSubmittal?.productType, "");
  assert.equal(result.workflowState.completenessResult?.status, "incomplete");
  assert.equal(
    result.workflowState.routingDecision?.destination,
    "return_to_subcontractor",
  );
  assert.equal(
    result.workflowState.executiveDecision?.decision,
    "return_to_subcontractor",
  );
  assert(
    result.workflowState.executiveDecision?.nextActions.includes(
      "Contact the subcontractor with the return notice and required corrections.",
    ),
  );
});
