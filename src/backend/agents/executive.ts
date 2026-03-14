import type {
  ExecutiveDecision,
  WorkflowLogEntry,
  WorkflowState,
} from "../schemas/workflow";
import {
  sendEmail,
  type EmailDeliveryResult,
  type SendEmailInput,
} from "../notifications/email";

export type ExecutiveWorkflowStatus =
  | "executive_returned_to_subcontractor"
  | "executive_escalated_to_human"
  | "executive_approved_internal_progression"
  | "executive_continued_workflow";

export type ExecutiveAgentResult = {
  executiveDecision: ExecutiveDecision;
  workflowStatusUpdate: ExecutiveWorkflowStatus;
};

export type ExecutiveNotificationResult = {
  status: "sent" | "skipped" | "failed";
  message: string;
};

type ExecutiveReadyWorkflowState = WorkflowState & {
  parsedSubmittal: NonNullable<WorkflowState["parsedSubmittal"]>;
  requirementSet: NonNullable<WorkflowState["requirementSet"]>;
  completenessResult: NonNullable<WorkflowState["completenessResult"]>;
  comparisonResult: NonNullable<WorkflowState["comparisonResult"]>;
  routingDecision: NonNullable<WorkflowState["routingDecision"]>;
};

const hasCoreWorkflowEvidence = (
  workflowState: WorkflowState,
): workflowState is ExecutiveReadyWorkflowState =>
  Boolean(
    workflowState.parsedSubmittal &&
      workflowState.requirementSet &&
      workflowState.completenessResult &&
      workflowState.comparisonResult &&
      workflowState.routingDecision,
  );

const buildReasoning = (...items: string[]): string[] => items;

export const runExecutiveAgent = (
  workflowState: WorkflowState,
): ExecutiveAgentResult => {
  if (!hasCoreWorkflowEvidence(workflowState)) {
    return {
      executiveDecision: {
        decision: "return_to_subcontractor",
        summary:
          "Workflow evidence is incomplete, so the package cannot advance.",
        reasoning: buildReasoning(
          "The executive review requires parsed submittal facts, requirements, completeness, comparison, and routing outputs.",
          "At least one required workflow artifact is missing from the shared state.",
          "The safest deterministic action is to stop progression and request a complete resubmittal package.",
        ),
        nextActions: [
          "Return the package to the subcontractor workflow owner.",
          "Contact the subcontractor to explain the missing workflow evidence and required resubmittal.",
          "Regenerate the missing workflow artifacts before the package re-enters executive review.",
          "Resubmit the package only after the backend state is complete.",
        ],
      },
      workflowStatusUpdate: "executive_returned_to_subcontractor",
    };
  }

  const completenessResult = workflowState.completenessResult;
  const comparisonResult = workflowState.comparisonResult;
  const routingDecision = workflowState.routingDecision;
  const parsedSubmittal = workflowState.parsedSubmittal;
  const requirementSet = workflowState.requirementSet;

  if (
    completenessResult.status === "incomplete" ||
    routingDecision.destination === "return_to_subcontractor"
  ) {
    return {
      executiveDecision: {
        decision: "return_to_subcontractor",
        summary:
          "The submittal is incomplete and must be returned for correction.",
        reasoning: buildReasoning(
          `${completenessResult.missingDocuments.length} mandatory document(s) are still missing.`,
          routingDecision.rationale,
          "An incomplete package should not consume internal review capacity.",
        ),
        nextActions: [
          "Return the package to the subcontractor.",
          "Contact the subcontractor with the return notice and required corrections.",
          "Request the missing mandatory documents listed by the completeness review.",
          "Re-run the workflow after a complete resubmittal is received.",
        ],
      },
      workflowStatusUpdate: "executive_returned_to_subcontractor",
    };
  }

  if (
    completenessResult.status === "needs_human_review" ||
    comparisonResult.status === "deviation_detected" ||
    comparisonResult.status === "unclear" ||
    routingDecision.destination === "human_exception_queue"
  ) {
    return {
      executiveDecision: {
        decision: "escalate_to_human",
        summary:
          "The package needs human judgment before the workflow can proceed.",
        reasoning: buildReasoning(
          `Completeness status is "${completenessResult.status}" and comparison status is "${comparisonResult.status}".`,
          `${comparisonResult.mismatches.length} mismatch(es) and ${comparisonResult.unclearItems.length} unclear item(s) remain unresolved.`,
          routingDecision.rationale,
        ),
        nextActions: [
          "Escalate the package to the human exception queue.",
          "Attach the comparison and completeness findings for manual adjudication.",
          "Hold automatic progression until a reviewer records a decision.",
        ],
      },
      workflowStatusUpdate: "executive_escalated_to_human",
    };
  }

  if (
    completenessResult.status === "complete" &&
    comparisonResult.status === "compliant" &&
    routingDecision.destination === "auto_route_internal_review"
  ) {
    return {
      executiveDecision: {
        decision: "approve_internal_progression",
        summary:
          "The submittal is complete, compliant, and approved to move forward internally.",
        reasoning: buildReasoning(
          `Parsed product "${parsedSubmittal.productType}" aligns with spec section "${requirementSet.specSection}".`,
          `The comparison review recorded ${comparisonResult.summary.matchCount} match(es) with no mismatches or unclear items.`,
          routingDecision.rationale,
        ),
        nextActions: [
          "Advance the package to internal review.",
          "Carry the compliant comparison summary into the review handoff.",
          "Preserve the executive approval decision in workflow logs.",
        ],
      },
      workflowStatusUpdate: "executive_approved_internal_progression",
    };
  }

  return {
    executiveDecision: {
      decision: "continue",
      summary:
        "The workflow can continue, but it has not reached an approval or exception branch.",
      reasoning: buildReasoning(
        `Current workflow status is "${workflowState.currentStatus}".`,
        "The shared state is complete enough to avoid a return, but it does not satisfy a terminal executive branch.",
        "Continuing the deterministic workflow is the correct operational action.",
      ),
      nextActions: [
        "Continue the next deterministic backend step.",
        "Preserve the current routing and review artifacts.",
        "Re-run executive review when the workflow reaches the next decision gate.",
      ],
    },
    workflowStatusUpdate: "executive_continued_workflow",
  };
};

export const buildExecutiveLogEntry = (
  result: ExecutiveAgentResult,
  timestamp: string,
): WorkflowLogEntry => ({
  agent: "executive",
  message: `${result.executiveDecision.decision}: ${result.executiveDecision.summary}`,
  timestamp,
});

export const applyExecutiveDecisionToWorkflowState = (
  workflowState: WorkflowState,
  result: ExecutiveAgentResult,
): WorkflowState => ({
  ...workflowState,
  currentStatus: result.workflowStatusUpdate,
  executiveDecision: result.executiveDecision,
});

function buildReturnNoticeEmail(
  workflowState: WorkflowState,
  executiveResult: ExecutiveAgentResult,
): SendEmailInput | null {
  if (executiveResult.executiveDecision.decision !== "return_to_subcontractor") {
    return null;
  }

  if (!workflowState.subcontractorEmail) {
    return null;
  }

  const missingDocuments = workflowState.completenessResult?.missingDocuments ?? [];
  const missingDocumentSection =
    missingDocuments.length > 0
      ? `Missing documents:\n- ${missingDocuments.join("\n- ")}\n\n`
      : "";
  const reasoningSection = executiveResult.executiveDecision.reasoning
    .map((reason) => `- ${reason}`)
    .join("\n");

  return {
    to: workflowState.subcontractorEmail,
    subject: `Submittal returned for correction: ${workflowState.submittalTitle}`,
    text: [
      "Your submittal has been returned for correction.",
      "",
      `Project: ${workflowState.projectName}`,
      `Submittal: ${workflowState.submittalTitle}`,
      "",
      missingDocumentSection,
      "Executive summary:",
      executiveResult.executiveDecision.summary,
      "",
      "Reasoning:",
      reasoningSection,
      "",
      "Next actions:",
      executiveResult.executiveDecision.nextActions.map((action) => `- ${action}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function toNotificationMessage(result: EmailDeliveryResult): ExecutiveNotificationResult {
  if (result.status === "sent") {
    return {
      status: "sent",
      message: `Delivered mock return notice email to ${result.recipient} at ${result.mailboxPath}.`,
    };
  }

  if (result.status === "failed") {
    return {
      status: "failed",
      message: `Failed to send return notice email${result.recipient ? ` to ${result.recipient}` : ""}: ${result.reason}`,
    };
  }

  return {
    status: "skipped",
    message: `Skipped return notice email: ${result.reason}`,
  };
}

export async function dispatchExecutiveNotifications(
  workflowState: WorkflowState,
  executiveResult: ExecutiveAgentResult,
  options?: {
    sendEmailImpl?: (input: SendEmailInput) => Promise<EmailDeliveryResult>;
  },
): Promise<ExecutiveNotificationResult> {
  const message = buildReturnNoticeEmail(workflowState, executiveResult);

  if (!message) {
    return {
      status: "skipped",
      message: "No subcontractor email was available for the return notice.",
    };
  }

  const sendEmailImpl = options?.sendEmailImpl ?? sendEmail;
  const emailResult = await sendEmailImpl(message);
  return toNotificationMessage(emailResult);
}
