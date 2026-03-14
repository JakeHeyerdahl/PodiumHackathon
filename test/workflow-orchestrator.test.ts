import assert from "node:assert/strict";
import path from "node:path";
import test, { before } from "node:test";

import { runSubmittalWorkflow } from "../src/backend/orchestrator/runWorkflow";
import { generateParserFixtures } from "../scripts/generate-parser-fixtures";
import { loadLocalEnv } from "../scripts/load-local-env";

const generatedFixtureRoot = path.resolve(
  process.cwd(),
  "scripts/fixtures/generated",
);

before(async () => {
  loadLocalEnv();
  await generateParserFixtures();
});

test("workflow happy path advances a complete compliant package", async () => {
  const result = await runSubmittalWorkflow(
    {
      projectName: "Demo Project",
      submittalTitle: "Packaged Indoor Air Handling Unit",
      sourceType: "upload",
      documents: [
        {
          fileName: "01-submittal-cover.pdf",
          path: "good-submittal/01-submittal-cover.pdf",
        },
        {
          fileName: "02-product-data.pdf",
          path: "good-submittal/02-product-data.pdf",
        },
        {
          fileName: "03-shop-drawing.pdf",
          path: "good-submittal/03-shop-drawing.pdf",
        },
        {
          fileName: "04-warranty.pdf",
          path: "good-submittal/04-warranty.pdf",
        },
        {
          fileName: "05-operations-manual.pdf",
          path: "good-submittal/05-operations-manual.pdf",
        },
      ],
    },
    {
      fixtureRoot: generatedFixtureRoot,
      reviewedAt: "2026-03-14T12:00:00.000Z",
      parserMode: "deterministic",
      parserModel: process.env.ANTHROPIC_MODEL,
      completenessModel: process.env.ANTHROPIC_COMPLETENESS_MODEL,
      comparisonModel: process.env.ANTHROPIC_COMPARISON_MODEL,
      routingModel: process.env.ANTHROPIC_ROUTING_MODEL,
    },
  );

  assert.equal(result.intakeResult.status, "accepted");
  assert.equal(result.workflowState.completenessResult?.status, "complete");
  assert.equal(result.workflowState.comparisonResult?.status, "compliant");
  assert.equal(
    result.workflowState.routingDecision?.destination,
    "auto_route_internal_review",
  );
  assert.equal(
    result.workflowState.executiveDecision?.decision,
    "approve_internal_progression",
  );
  assert.equal(
    result.workflowState.currentStatus,
    "executive_approved_internal_progression",
  );
});

test("workflow exception path escalates a complete package with a declared deviation", async () => {
  const result = await runSubmittalWorkflow(
    {
      projectName: "Demo Project",
      submittalTitle: "Packaged Indoor Air Handling Unit",
      sourceType: "upload",
      documents: [
        {
          fileName: "01-submittal-cover.pdf",
          path: "good-submittal/01-submittal-cover.pdf",
        },
        {
          fileName: "02-product-data.pdf",
          path: "good-submittal/02-product-data.pdf",
        },
        {
          fileName: "03-shop-drawing.pdf",
          path: "good-submittal/03-shop-drawing.pdf",
        },
        {
          fileName: "04-warranty.pdf",
          path: "good-submittal/04-warranty.pdf",
        },
        {
          fileName: "05-operations-manual.pdf",
          path: "good-submittal/05-operations-manual.pdf",
        },
        {
          fileName: "06-deviation-letter.pdf",
          path: "deviation-submittal/03-deviation-letter.pdf",
        },
      ],
    },
    {
      fixtureRoot: generatedFixtureRoot,
      reviewedAt: "2026-03-14T12:00:00.000Z",
      parserMode: "deterministic",
      parserModel: process.env.ANTHROPIC_MODEL,
      completenessModel: process.env.ANTHROPIC_COMPLETENESS_MODEL,
      comparisonModel: process.env.ANTHROPIC_COMPARISON_MODEL,
      routingModel: process.env.ANTHROPIC_ROUTING_MODEL,
    },
  );

  assert.equal(result.intakeResult.status, "accepted");
  assert.equal(result.workflowState.completenessResult?.status, "complete");
  assert.equal(
    result.workflowState.comparisonResult?.status,
    "deviation_detected",
  );
  assert.equal(
    result.workflowState.routingDecision?.destination,
    "human_exception_queue",
  );
  assert.equal(
    result.workflowState.executiveDecision?.decision,
    "escalate_to_human",
  );
  assert.equal(
    result.workflowState.currentStatus,
    "executive_escalated_to_human",
  );
});
