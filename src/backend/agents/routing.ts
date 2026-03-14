import { z } from "zod";

import {
  createLlmProvider,
  type CreateLlmProviderOptions,
  type LlmProvider,
} from "../providers";
import type {
  ComparisonResult,
  CompletenessResult,
  RoutingDestination,
  RoutingDecision,
} from "../schemas/workflow";

export type RoutingPolicyInput =
  | string
  | {
      missingDocumentDestination?: RoutingDestination;
      deviationDestination?: RoutingDestination;
      completeDestination?: RoutingDestination;
      escalationTriggers?: string[];
      rationale?: string;
    };

export type RoutingInput = {
  completenessResult: CompletenessResult;
  comparisonResult: ComparisonResult;
  routingPolicy: RoutingPolicyInput;
};

export type RunRoutingAgentInput = RoutingInput &
  CreateLlmProviderOptions & {
    model?: string;
    allowDeterministicFallback?: boolean;
    llmProvider?: LlmProvider;
  };

type ResolvedRoutingPolicy = {
  missingDocumentDestination: RoutingDestination;
  deviationDestination: RoutingDestination;
  completeDestination: RoutingDestination;
  normalizedPolicyLabel: string;
};

const DEFAULT_ROUTING_POLICY: ResolvedRoutingPolicy = {
  missingDocumentDestination: "return_to_subcontractor",
  deviationDestination: "human_exception_queue",
  completeDestination: "auto_route_internal_review",
  normalizedPolicyLabel: "",
};

const routingDecisionSchema = z.object({
  destination: z.enum([
    "auto_route_internal_review",
    "return_to_subcontractor",
    "human_exception_queue",
  ]),
  actions: z.array(z.string()).min(1).max(5),
  rationale: z.string().min(1),
});

const normalizePolicyLabel = (routingPolicy: RoutingPolicyInput): string => {
  if (typeof routingPolicy !== "string") {
    return routingPolicy.rationale?.trim().toLowerCase() ?? "";
  }

  return routingPolicy.trim().toLowerCase();
};

const isRoutingDestination = (
  value: string | undefined,
): value is RoutingDestination =>
  value === "auto_route_internal_review" ||
  value === "return_to_subcontractor" ||
  value === "human_exception_queue";

const resolveStringPolicyDestination = (
  routingPolicy: string,
): Partial<ResolvedRoutingPolicy> => {
  const normalizedPolicy = routingPolicy.trim().toLowerCase();

  return (
    isRoutingDestination(normalizedPolicy)
      ? {
          missingDocumentDestination:
            normalizedPolicy === "return_to_subcontractor"
              ? "return_to_subcontractor"
              : DEFAULT_ROUTING_POLICY.missingDocumentDestination,
          deviationDestination:
            normalizedPolicy === "human_exception_queue"
              ? "human_exception_queue"
              : DEFAULT_ROUTING_POLICY.deviationDestination,
          completeDestination:
            normalizedPolicy === "auto_route_internal_review"
              ? "auto_route_internal_review"
              : DEFAULT_ROUTING_POLICY.completeDestination,
        }
      : {
          deviationDestination:
            normalizedPolicy.includes("human") ||
            normalizedPolicy.includes("manual") ||
            normalizedPolicy.includes("exception")
              ? "human_exception_queue"
              : undefined,
        }
  );
};

const resolveRoutingPolicy = (
  routingPolicy: RoutingPolicyInput,
): ResolvedRoutingPolicy => {
  const normalizedPolicyLabel = normalizePolicyLabel(routingPolicy);

  if (typeof routingPolicy === "string") {
    return {
      ...DEFAULT_ROUTING_POLICY,
      ...resolveStringPolicyDestination(routingPolicy),
      normalizedPolicyLabel,
    };
  }

  return {
    missingDocumentDestination:
      routingPolicy.missingDocumentDestination ??
      DEFAULT_ROUTING_POLICY.missingDocumentDestination,
    deviationDestination:
      routingPolicy.deviationDestination ??
      DEFAULT_ROUTING_POLICY.deviationDestination,
    completeDestination:
      routingPolicy.completeDestination ??
      DEFAULT_ROUTING_POLICY.completeDestination,
    normalizedPolicyLabel,
  };
};

const buildRoutingPromptPayload = (
  input: RoutingInput,
  resolvedPolicy: ResolvedRoutingPolicy,
) => ({
  task:
    "Choose the next routing destination for a construction submittal package using completeness, comparison, and routing-policy signals.",
  rules: [
    "Return exactly one destination and keep it aligned with the evidence.",
    "Incomplete packages should normally go to the missingDocumentDestination unless the provided policy explicitly says otherwise.",
    "Deviation, unclear, or needs_human_review states should normally go to the deviationDestination unless the provided policy explicitly says otherwise.",
    "Only route to the completeDestination when completeness is complete and comparison is compliant.",
    "Do not invent new destinations.",
    "Write 2 to 4 short actions that an operator can follow next.",
    "Keep rationale concise and evidence-based.",
  ],
  resolvedPolicy: {
    missingDocumentDestination: resolvedPolicy.missingDocumentDestination,
    deviationDestination: resolvedPolicy.deviationDestination,
    completeDestination: resolvedPolicy.completeDestination,
    label: resolvedPolicy.normalizedPolicyLabel || null,
  },
  completenessResult: {
    status: input.completenessResult.status,
    isReviewable: input.completenessResult.isReviewable,
    missingDocuments: input.completenessResult.missingDocuments,
    ambiguousDocuments: input.completenessResult.ambiguousDocuments,
    rationale: input.completenessResult.rationale,
  },
  comparisonResult: {
    status: input.comparisonResult.status,
    matches: input.comparisonResult.matches,
    mismatches: input.comparisonResult.mismatches,
    unclearItems: input.comparisonResult.unclearItems,
    summary: input.comparisonResult.summary,
  },
});

export const determineRoutingDecision = ({
  completenessResult,
  comparisonResult,
  routingPolicy,
}: RoutingInput): RoutingDecision => {
  const resolvedPolicy = resolveRoutingPolicy(routingPolicy);

  if (completenessResult.status === "incomplete") {
    return {
      destination: resolvedPolicy.missingDocumentDestination,
      actions: [
        "Return the package to the subcontractor.",
        "Request the missing mandatory documents listed in completenessResult.missingDocuments.",
        "Hold executive review until a complete resubmittal is received.",
      ],
      rationale:
        "The package is incomplete, so it should be returned for completion before any internal review step.",
    };
  }

  if (
    completenessResult.status === "needs_human_review" ||
    comparisonResult.status === "deviation_detected" ||
    comparisonResult.status === "unclear"
  ) {
    return {
      destination: resolvedPolicy.deviationDestination,
      actions: [
        "Send the package to the human exception queue.",
        "Flag the unresolved comparison or completeness issues for manual adjudication.",
        "Pause automatic progression until a reviewer records a decision.",
      ],
      rationale:
        resolvedPolicy.normalizedPolicyLabel
          ? `The package requires human judgment before executive review based on its status signals or routing policy "${resolvedPolicy.normalizedPolicyLabel}".`
          : "The package contains ambiguity or detected deviations that require human judgment before executive review.",
    };
  }

  if (
    completenessResult.status === "complete" &&
    comparisonResult.status === "compliant"
  ) {
    return {
      destination: resolvedPolicy.completeDestination,
      actions: [
        "Advance the package to internal review.",
        "Attach the compliant comparison summary for the reviewer.",
        "Preserve the routing policy used for auditability.",
      ],
      rationale: resolvedPolicy.normalizedPolicyLabel
        ? `The package is complete and compliant, and the routing policy "${resolvedPolicy.normalizedPolicyLabel}" allows automatic internal review.`
        : "The package is complete and compliant, so it can proceed to internal review automatically.",
    };
  }

  return {
    destination: "human_exception_queue",
    actions: [
      "Send the package to the human exception queue.",
      "Record the unexpected routing state for manual review.",
      "Prevent automatic advancement until the state is clarified.",
    ],
    rationale:
      "The available inputs did not match a standard deterministic routing branch, so manual review is the safest path.",
  };
};

export async function runRoutingAgent(
  input: RunRoutingAgentInput,
): Promise<RoutingDecision> {
  const deterministicDecision = determineRoutingDecision(input);
  const resolvedPolicy = resolveRoutingPolicy(input.routingPolicy);
  const llmProvider =
    input.llmProvider ??
    createLlmProvider({
      provider: input.provider,
      anthropicApiKey: input.anthropicApiKey,
      anthropicModel: input.anthropicModel,
      allowMockFallback: input.allowMockFallback,
    });

  try {
    const response = await llmProvider.generateObject({
      instructions:
        "You are a construction submittal routing agent. Return strict structured JSON and choose the safest destination supported by the evidence and routing policy.",
      input: JSON.stringify(buildRoutingPromptPayload(input, resolvedPolicy)),
      schema: routingDecisionSchema,
      schemaName: "routing_decision",
      model:
        input.model ??
        input.anthropicModel ??
        process.env.ANTHROPIC_ROUTING_MODEL ??
        process.env.ANTHROPIC_MODEL,
      maxOutputTokens: 1200,
      fallbackObject: deterministicDecision,
    });

    return response.object;
  } catch (error) {
    if (!input.allowDeterministicFallback) {
      throw error;
    }

    return deterministicDecision;
  }
}
