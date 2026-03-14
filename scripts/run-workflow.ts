import { dirname, resolve } from "node:path";
import { promises as fs } from "node:fs";

import { runSubmittalWorkflow } from "../src/backend/orchestrator/runWorkflow";
import type { UploadIntakePayload } from "../src/backend/schemas/intake";
import type { WorkflowRunResult } from "../src/backend/orchestrator/runWorkflow";
import { loadLocalEnv } from "./load-local-env";
import { stableJsonStringify } from "./stable-json";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readOption(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function formatValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "(unresolved)";
}

function formatList(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return "(none)";
  }

  return values.join(", ");
}

function shortenText(value: string | undefined, maxLength = 180): string {
  if (!value) {
    return "(no text)";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function buildDebugReport(result: WorkflowRunResult): string {
  const lines: string[] = [];
  const { intakeResult, workflowState, detailedParsedSubmittal, reconstructedRequirementSet } = result;

  lines.push("=== Workflow Summary ===");
  lines.push(`Project: ${workflowState.projectName}`);
  lines.push(`Submittal: ${workflowState.submittalTitle}`);
  lines.push(`Final status: ${workflowState.currentStatus}`);
  lines.push(`Intake: ${intakeResult.status}`);
  lines.push(`Parser: ${detailedParsedSubmittal?.parserSummary.status ?? "(not run)"}`);
  lines.push(`Completeness: ${workflowState.completenessResult?.status ?? "(not run)"}`);
  lines.push(`Comparison: ${workflowState.comparisonResult?.status ?? "(not run)"}`);
  lines.push(`Routing: ${workflowState.routingDecision?.destination ?? "(not run)"}`);
  lines.push(`Executive: ${workflowState.executiveDecision?.decision ?? "(not run)"}`);

  lines.push("");
  lines.push("=== Intake Documents ===");
  for (const document of intakeResult.envelope?.documents ?? []) {
    lines.push(`- ${document.fileName}`);
    lines.push(`  extraction: ${document.extractionStatus}`);
    lines.push(`  chars: ${document.fullText?.length ?? 0}`);
    lines.push(`  warnings: ${formatList(document.warnings)}`);
    lines.push(`  sample: ${shortenText(document.fullText)}`);
  }

  if (detailedParsedSubmittal) {
    lines.push("");
    lines.push("=== Parser Output ===");
    lines.push(`specSection: ${formatValue(detailedParsedSubmittal.specSection.value)}`);
    lines.push(`productType: ${formatValue(detailedParsedSubmittal.productType.value)}`);
    lines.push(`manufacturer: ${formatValue(detailedParsedSubmittal.manufacturer.value)}`);
    lines.push(`modelNumber: ${formatValue(detailedParsedSubmittal.modelNumber.value)}`);
    lines.push(`revision: ${formatValue(detailedParsedSubmittal.revision.value)}`);
    lines.push(`unresolvedFields: ${formatList(detailedParsedSubmittal.unresolvedFields)}`);
    lines.push(`missingDocuments: ${formatList(detailedParsedSubmittal.missingDocuments)}`);
    lines.push(`deviations: ${formatList(detailedParsedSubmittal.deviations.map((issue) => issue.message))}`);

    lines.push("");
    lines.push("Document classifications:");
    for (const document of detailedParsedSubmittal.documentParses) {
      lines.push(
        `- ${document.fileName}: ${document.documentType} | extraction=${document.extractionStatus} | chars=${document.detectedTextLength} | coverage=${document.textCoverage}`,
      );
    }

    lines.push("");
    lines.push("Parser issues:");
    for (const issue of detailedParsedSubmittal.issues) {
      lines.push(`- [${issue.code}] ${issue.message}`);
    }

    lines.push("");
    lines.push("Parser trace:");
    for (const step of detailedParsedSubmittal.trace) {
      lines.push(`- ${step.step}: ${step.message}`);
    }
  }

  if (reconstructedRequirementSet) {
    lines.push("");
    lines.push("=== Requirement Set ===");
    lines.push(`specSection: ${reconstructedRequirementSet.specSection.value}`);
    lines.push(
      `requiredAttributes: ${formatList(reconstructedRequirementSet.requiredAttributes.map((attribute) => attribute.key))}`,
    );
    lines.push(
      `requiredDocuments: ${formatList(reconstructedRequirementSet.requiredDocuments.map((document) => document.label))}`,
    );
    lines.push(`assumptions: ${formatList(reconstructedRequirementSet.assumptions)}`);
  }

  if (workflowState.completenessResult) {
    lines.push("");
    lines.push("=== Completeness ===");
    lines.push(`status: ${workflowState.completenessResult.status}`);
    lines.push(`reviewable: ${String(workflowState.completenessResult.isReviewable)}`);
    lines.push(`missingDocuments: ${formatList(workflowState.completenessResult.missingDocuments)}`);
    lines.push(`ambiguousDocuments: ${formatList(workflowState.completenessResult.ambiguousDocuments)}`);
    lines.push(`summary: ${workflowState.completenessResult.rationale.summary}`);
    lines.push("facts:");
    for (const fact of workflowState.completenessResult.rationale.facts) {
      lines.push(`- ${fact}`);
    }
  }

  if (workflowState.comparisonResult) {
    lines.push("");
    lines.push("=== Comparison ===");
    lines.push(`status: ${workflowState.comparisonResult.status}`);
    lines.push(
      `summary: ${workflowState.comparisonResult.summary.matchCount} match(es), ${workflowState.comparisonResult.summary.mismatchCount} mismatch(es), ${workflowState.comparisonResult.summary.unclearCount} unclear item(s)`,
    );

    const noteworthyItems = [
      ...workflowState.comparisonResult.mismatches,
      ...workflowState.comparisonResult.unclearItems,
    ];
    if (noteworthyItems.length > 0) {
      lines.push("noteworthy items:");
      for (const item of noteworthyItems) {
        lines.push(
          `- ${item.field}: expected=${String(item.expected)} actual=${String(item.actual)}${item.note ? ` | ${item.note}` : ""}`,
        );
      }
    }
  }

  if (workflowState.routingDecision) {
    lines.push("");
    lines.push("=== Routing ===");
    lines.push(`destination: ${workflowState.routingDecision.destination}`);
    lines.push(`rationale: ${workflowState.routingDecision.rationale}`);
    lines.push("actions:");
    for (const action of workflowState.routingDecision.actions) {
      lines.push(`- ${action}`);
    }
  }

  if (workflowState.executiveDecision) {
    lines.push("");
    lines.push("=== Executive ===");
    lines.push(`decision: ${workflowState.executiveDecision.decision}`);
    lines.push(`summary: ${workflowState.executiveDecision.summary}`);
    lines.push("reasoning:");
    for (const reason of workflowState.executiveDecision.reasoning) {
      lines.push(`- ${reason}`);
    }
    lines.push("next actions:");
    for (const action of workflowState.executiveDecision.nextActions) {
      lines.push(`- ${action}`);
    }
  }

  lines.push("");
  lines.push("=== Workflow Log ===");
  for (const entry of workflowState.logs) {
    lines.push(`- ${entry.agent}: ${entry.message}`);
  }

  return lines.join("\n");
}

async function main() {
  loadLocalEnv();

  const fixtureArg = process.argv[2];

  if (!fixtureArg) {
    console.error("Usage: npx tsx scripts/run-workflow.ts <fixture-path> [--json]");
    process.exit(1);
  }

  const fixturePath = resolve(process.cwd(), fixtureArg);
  const fixtureRoot = dirname(fixturePath);
  const rawFixture = await fs.readFile(fixturePath, "utf-8");
  const payload = JSON.parse(rawFixture) as UploadIntakePayload;

  const result = await runSubmittalWorkflow(payload, {
    fixtureRoot,
  });

  if (hasFlag("--json")) {
    console.log(stableJsonStringify(result));
    return;
  }

  const outputPath = readOption("--write-json");
  if (outputPath) {
    await fs.writeFile(resolve(process.cwd(), outputPath), `${stableJsonStringify(result)}\n`);
  }

  console.log(buildDebugReport(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
