import path from "node:path";

import { runTechnicalComparisonAgent } from "../agents/comparison";
import { runCompletenessAgent } from "../agents/completeness";
import {
  applyExecutiveDecisionToWorkflowState,
  buildExecutiveLogEntry,
  runExecutiveAgent,
} from "../agents/executive";
import { runIntakeAgent } from "../agents/intake";
import { parseSubmittal } from "../agents/parser";
import { buildRequirementSet } from "../agents/requirements";
import { determineRoutingDecision } from "../agents/routing";
import type {
  DetailedParsedSubmittal,
  IncomingDocument,
  RequirementSet,
  RoutingDecision,
  WorkflowLogEntry,
  WorkflowState,
} from "../schemas/workflow";
import type { ComparisonResult as WorkflowComparisonResult } from "../schemas/workflow";
import type {
  IntakeDocument,
  IntakeResult,
  RawFixtureDocument,
  UploadIntakePayload,
} from "../schemas/intake";
import type {
  RequirementSet as ReconstructedRequirementSet,
  SerializableValue,
} from "../agents/requirements";

export type WorkflowRunOptions = {
  fixtureRoot: string;
  reviewedAt?: string;
  parserMode?: "llm" | "deterministic";
  parserModel?: string;
  completenessModel?: string;
  allowDeterministicCompletenessFallback?: boolean;
};

export type WorkflowRunResult = {
  intakeResult: IntakeResult;
  workflowState: WorkflowState;
  detailedParsedSubmittal?: DetailedParsedSubmittal;
  reconstructedRequirementSet?: ReconstructedRequirementSet;
  comparisonResult?: WorkflowComparisonResult;
  routingDecision?: RoutingDecision;
};

function atTimestamp(timestamp: string, agent: string, message: string): WorkflowLogEntry {
  return {
    agent,
    message,
    timestamp,
  };
}

function buildRawDocumentsByName(
  rawDocuments: RawFixtureDocument[] | undefined,
): Map<string, RawFixtureDocument[]> {
  const rawDocumentsByName = new Map<string, RawFixtureDocument[]>();

  for (const rawDocument of rawDocuments ?? []) {
    const queue = rawDocumentsByName.get(rawDocument.fileName) ?? [];
    queue.push(rawDocument);
    rawDocumentsByName.set(rawDocument.fileName, queue);
  }

  return rawDocumentsByName;
}

function toIncomingDocuments(
  documents: IntakeDocument[],
  rawDocumentsByName: Map<string, RawFixtureDocument[]>,
  fixtureRoot: string,
): IncomingDocument[] {
  const incomingDocuments: IncomingDocument[] = [];

  for (const document of documents) {
    const rawDocument = (rawDocumentsByName.get(document.fileName) ?? []).shift();

    if (!rawDocument || document.extension !== ".pdf") {
      continue;
    }

    incomingDocuments.push({
      documentId: document.documentId,
      fileName: document.fileName,
      mimeType: document.mimeType ?? rawDocument.mimeType ?? "application/pdf",
      filePath: path.resolve(fixtureRoot, rawDocument.path),
    });
  }

  return incomingDocuments;
}

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

function toWorkflowParsedSubmittal(parsedSubmittal: DetailedParsedSubmittal): WorkflowState["parsedSubmittal"] {
  return {
    specSection: parsedSubmittal.specSection.value ?? "",
    productType: parsedSubmittal.productType.value ?? "",
    manufacturer: parsedSubmittal.manufacturer.value ?? "",
    modelNumber: parsedSubmittal.modelNumber.value ?? "",
    revision: parsedSubmittal.revision.value ?? undefined,
    submittedDocuments: parsedSubmittal.documentParses.map((document) => ({
      id: document.documentId,
      kind: document.documentType,
      title: document.fileName,
      sourceDocument: document.fileName,
    })),
    missingDocuments: parsedSubmittal.missingDocuments,
    deviations: parsedSubmittal.deviations.map((issue) => issue.message),
  };
}

function toWorkflowRequirementSet(
  requirementSet: ReconstructedRequirementSet,
): RequirementSet {
  return {
    specSection: requirementSet.specSection.value,
    requiredAttributes: requirementSet.requiredAttributes
      .filter((attribute) => attribute.required)
      .map((attribute) => attribute.key),
    requiredDocuments: requirementSet.requiredDocuments.map((document) => ({
      key: document.key,
      label: document.label,
      required: document.required,
    })),
    routingPolicy: requirementSet.routingPolicy.completeDestination,
  };
}

function toComparisonValue(value: SerializableValue | undefined) {
  return value ?? null;
}

function toComparisonInputs(
  parsedSubmittal: DetailedParsedSubmittal,
  requirementSet: ReconstructedRequirementSet,
) {
  const expectedTopLevel = Object.fromEntries(
    requirementSet.requiredAttributes
      .filter(
        (attribute) =>
          attribute.required &&
          (
            attribute.key === "productType" ||
            attribute.key === "manufacturer" ||
            attribute.key === "modelNumber" ||
            attribute.key === "revision"
          ),
      )
      .map((attribute) => [attribute.key, toComparisonValue(attribute.expectedValue)]),
  ) as Record<string, string | number | boolean | null>;

  const expectedAttributes = Object.fromEntries(
    requirementSet.requiredAttributes
      .filter(
        (attribute) =>
          attribute.required &&
          !["productType", "manufacturer", "modelNumber", "revision"].includes(
            attribute.key,
          ),
      )
      .map((attribute) => [attribute.key, toComparisonValue(attribute.expectedValue)]),
  );

  return {
    parsedSubmittal: {
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
      deviations: parsedSubmittal.deviations.map((issue) => issue.message),
    },
    requirementSet: {
      specSection: requirementSet.specSection.value,
      ...expectedTopLevel,
      requiredAttributes: expectedAttributes,
    },
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

function createInitialWorkflowState(
  payload: UploadIntakePayload,
  intakeResult: IntakeResult,
  incomingDocuments: IncomingDocument[],
  reviewedAt: string,
): WorkflowState {
  const envelope = intakeResult.envelope;

  return {
    runId: envelope?.runId ?? `run-${reviewedAt}`,
    projectName: envelope?.projectName ?? payload.projectName ?? "Unknown Project",
    submittalTitle:
      payload.submittalTitle ??
      incomingDocuments[0]?.fileName ??
      "Untitled submittal",
    currentStatus:
      intakeResult.status === "rejected" ? "intake_rejected" : "intake_accepted",
    incomingDocuments: incomingDocuments.map((document) => document.fileName),
    logs: [
      atTimestamp(
        reviewedAt,
        "intake",
        `${intakeResult.status}: ${intakeResult.summary}`,
      ),
    ],
  };
}

export async function runSubmittalWorkflow(
  payload: UploadIntakePayload,
  options: WorkflowRunOptions,
): Promise<WorkflowRunResult> {
  const reviewedAt = options.reviewedAt ?? new Date().toISOString();
  const intakeResult = await runIntakeAgent(payload, options.fixtureRoot);
  const rawDocumentsByName = buildRawDocumentsByName(payload.documents);
  const incomingDocuments = intakeResult.envelope
    ? toIncomingDocuments(
        intakeResult.envelope.documents,
        rawDocumentsByName,
        options.fixtureRoot,
      )
    : [];

  let workflowState = createInitialWorkflowState(
    payload,
    intakeResult,
    incomingDocuments,
    reviewedAt,
  );

  if (intakeResult.status === "rejected" || incomingDocuments.length === 0) {
    if (incomingDocuments.length === 0) {
      workflowState = {
        ...workflowState,
        currentStatus: "workflow_blocked_no_pdf_documents",
        logs: [
          ...workflowState.logs,
          atTimestamp(
            reviewedAt,
            "orchestrator",
            "Workflow stopped because no parseable PDF documents were available after intake.",
          ),
        ],
      };
    }

    return {
      intakeResult,
      workflowState,
    };
  }

  const detailedParsedSubmittal = await parseSubmittal(incomingDocuments, {
    reviewedAt,
    mode: options.parserMode ?? "deterministic",
    model: options.parserModel,
  });
  workflowState = {
    ...workflowState,
    currentStatus: "parsed_submittal_ready",
    parsedSubmittal: toWorkflowParsedSubmittal(detailedParsedSubmittal),
    logs: [
      ...workflowState.logs,
      atTimestamp(
        reviewedAt,
        "parser",
        `Parser completed with status "${detailedParsedSubmittal.parserSummary.status}".`,
      ),
    ],
  };

  const reconstructedRequirementSet = buildRequirementSet({
    projectName: workflowState.projectName,
    submittalTitle: workflowState.submittalTitle,
    parsedSubmittal: toRequirementInput(detailedParsedSubmittal),
  });
  workflowState = {
    ...workflowState,
    currentStatus: "requirements_reconstructed",
    requirementSet: toWorkflowRequirementSet(reconstructedRequirementSet),
    logs: [
      ...workflowState.logs,
      atTimestamp(
        reviewedAt,
        "requirements",
        `Requirement set resolved for spec section "${reconstructedRequirementSet.specSection.value}".`,
      ),
    ],
  };

  const completenessResult = await runCompletenessAgent({
    parsedSubmittal: detailedParsedSubmittal,
    requirementSet: reconstructedRequirementSet,
    model: options.completenessModel,
    allowDeterministicFallback:
      options.allowDeterministicCompletenessFallback ?? true,
  });
  workflowState = {
    ...workflowState,
    currentStatus: "completeness_evaluated",
    completenessResult,
    logs: [
      ...workflowState.logs,
      atTimestamp(
        reviewedAt,
        "completeness",
        `Completeness review returned "${completenessResult.status}" in ${completenessResult.reviewMode ?? "deterministic"} mode.`,
      ),
    ],
  };

  const comparisonInputs = toComparisonInputs(
    detailedParsedSubmittal,
    reconstructedRequirementSet,
  );
  const rawComparisonResult = runTechnicalComparisonAgent(
    comparisonInputs.parsedSubmittal,
    comparisonInputs.requirementSet,
  );
  const comparisonResult = toWorkflowComparisonResult(rawComparisonResult);
  workflowState = {
    ...workflowState,
    currentStatus: "comparison_evaluated",
    comparisonResult,
    logs: [
      ...workflowState.logs,
      atTimestamp(
        reviewedAt,
        "comparison",
        `Technical comparison returned "${comparisonResult.status}".`,
      ),
    ],
  };

  const routingDecision = determineRoutingDecision({
    completenessResult,
    comparisonResult,
    routingPolicy: reconstructedRequirementSet.routingPolicy,
  });
  workflowState = {
    ...workflowState,
    currentStatus: "ready_for_executive_review",
    routingDecision,
    logs: [
      ...workflowState.logs,
      atTimestamp(
        reviewedAt,
        "routing",
        `Routing decision selected "${routingDecision.destination}".`,
      ),
    ],
  };

  const executiveResult = runExecutiveAgent(workflowState);
  workflowState = {
    ...applyExecutiveDecisionToWorkflowState(workflowState, executiveResult),
    logs: [
      ...workflowState.logs,
      buildExecutiveLogEntry(executiveResult, reviewedAt),
    ],
  };

  return {
    intakeResult,
    workflowState,
    detailedParsedSubmittal,
    reconstructedRequirementSet,
    comparisonResult,
    routingDecision,
  };
}
