import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  dispatchExecutiveNotifications,
  runExecutiveAgent,
} from "../src/backend/agents/executive";
import {
  clearMockInbox,
  readMockInbox,
} from "../src/backend/notifications/email";
import type { WorkflowState } from "../src/backend/schemas/workflow";

function createReadyWorkflowState(): WorkflowState {
  return {
    runId: "run-123",
    projectName: "Demo Project",
    submittalTitle: "Masonry Submittal",
    currentStatus: "ready_for_executive_review",
    incomingDocuments: ["submittal.pdf"],
    subcontractorEmail: "jdoe@example.com",
    parsedSubmittal: {
      specSection: "04 21 00",
      productType: "Concrete Masonry Units (CMU)",
      manufacturer: "Acme Block Co.",
      modelNumber: "CMU-8X8X16",
      submittedDocuments: [
        {
          id: "doc-1",
          kind: "product_data",
          title: "submittal.pdf",
        },
      ],
      missingDocuments: [],
      deviations: [],
    },
    requirementSet: {
      specSection: "04 21 00",
      requiredAttributes: ["manufacturer", "modelNumber"],
      requiredDocuments: [
        {
          key: "product_data",
          label: "Product Data",
          required: true,
        },
        {
          key: "shop_drawings",
          label: "Shop Drawings",
          required: true,
        },
      ],
      routingPolicy: "auto_route_internal_review",
    },
    completenessResult: {
      status: "incomplete",
      isReviewable: false,
      missingDocuments: ["Shop Drawings"],
      ambiguousDocuments: [],
      rationale: {
        summary: "Shop drawings are missing.",
        facts: ["1 mandatory document is missing."],
      },
    },
    comparisonResult: {
      status: "compliant",
      matches: [],
      mismatches: [],
      unclearItems: [],
      summary: {
        matchCount: 0,
        mismatchCount: 0,
        unclearCount: 0,
      },
    },
    routingDecision: {
      destination: "return_to_subcontractor",
      actions: ["Return the package to the subcontractor."],
      rationale: "Package is incomplete.",
    },
    logs: [],
  };
}

test("executive return path includes contacting the subcontractor", () => {
  const result = runExecutiveAgent(createReadyWorkflowState());

  assert.equal(result.executiveDecision.decision, "return_to_subcontractor");
  assert(
    result.executiveDecision.nextActions.includes(
      "Contact the subcontractor with the return notice and required corrections.",
    ),
  );
});

test("dispatchExecutiveNotifications skips email when no recipient is available", async () => {
  const result = await dispatchExecutiveNotifications(
    {
      ...createReadyWorkflowState(),
      subcontractorEmail: undefined,
    },
    runExecutiveAgent(createReadyWorkflowState()),
  );

  assert.equal(result.status, "skipped");
  assert.match(result.message, /No subcontractor email/i);
});

test("dispatchExecutiveNotifications sends a return email when the subcontractor email is present", async () => {
  process.env.MOCK_EMAIL_INBOX_PATH = path.resolve(
    process.cwd(),
    "tmp",
    "mock-email-inbox.executive-test.jsonl",
  );
  await clearMockInbox(process.env.MOCK_EMAIL_INBOX_PATH);

  const result = await dispatchExecutiveNotifications(
    createReadyWorkflowState(),
    runExecutiveAgent(createReadyWorkflowState()),
  );

  assert.equal(result.status, "sent");
  assert.match(result.message, /Delivered mock return notice email/i);

  const messages = await readMockInbox(process.env.MOCK_EMAIL_INBOX_PATH);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.to, "jdoe@example.com");
  assert.match(messages[0]?.subject ?? "", /returned for correction/i);
  assert.match(messages[0]?.text ?? "", /Shop Drawings/);
});
