import type {
  ComparisonResult,
  CompletenessResult,
  RoutingDecision,
} from "../schemas/workflow";

export type RoutingInput = {
  completenessResult: CompletenessResult;
  comparisonResult: ComparisonResult;
  routingPolicy: string;
};

const normalizePolicy = (routingPolicy: string): string =>
  routingPolicy.trim().toLowerCase();

const policyRequiresHumanReview = (routingPolicy: string): boolean => {
  const normalizedPolicy = normalizePolicy(routingPolicy);

  return (
    normalizedPolicy.includes("human") ||
    normalizedPolicy.includes("manual") ||
    normalizedPolicy.includes("exception")
  );
};

export const determineRoutingDecision = ({
  completenessResult,
  comparisonResult,
  routingPolicy,
}: RoutingInput): RoutingDecision => {
  const normalizedPolicy = normalizePolicy(routingPolicy);

  if (completenessResult.status === "incomplete") {
    return {
      destination: "return_to_subcontractor",
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
    comparisonResult.status === "unclear" ||
    policyRequiresHumanReview(routingPolicy)
  ) {
    return {
      destination: "human_exception_queue",
      actions: [
        "Send the package to the human exception queue.",
        "Flag the unresolved comparison or completeness issues for manual adjudication.",
        "Pause automatic progression until a reviewer records a decision.",
      ],
      rationale:
        normalizedPolicy
          ? `The package requires human judgment before executive review based on its status signals or routing policy "${normalizedPolicy}".`
          : "The package contains ambiguity or detected deviations that require human judgment before executive review.",
    };
  }

  if (
    completenessResult.status === "complete" &&
    comparisonResult.status === "compliant"
  ) {
    return {
      destination: "auto_route_internal_review",
      actions: [
        "Advance the package to internal review.",
        "Attach the compliant comparison summary for the reviewer.",
        "Preserve the routing policy used for auditability.",
      ],
      rationale: normalizedPolicy
        ? `The package is complete and compliant, and the routing policy "${normalizedPolicy}" allows automatic internal review.`
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
