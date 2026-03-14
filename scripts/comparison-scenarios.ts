import type {
  ParsedSubmittal,
  RequirementSet,
} from "../src/backend/agents/comparison";

export type ComparisonScenarioName =
  | "compliant"
  | "top-level-mismatch"
  | "missing-attribute"
  | "array-match"
  | "declared-deviation";

export type ComparisonScenario = {
  name: ComparisonScenarioName;
  description: string;
  parsedSubmittal: ParsedSubmittal;
  requirementSet: RequirementSet;
};

const scenarios: Record<ComparisonScenarioName, ComparisonScenario> = {
  compliant: {
    name: "compliant",
    description: "All required top-level fields and attributes align cleanly.",
    parsedSubmittal: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      revision: "B",
      extractedAttributes: {
        airflowCapacity: "12000 CFM",
        voltage: "480V",
      },
      deviations: [],
    },
    requirementSet: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      revision: "B",
      requiredAttributes: {
        airflowCapacity: "12000 CFM",
        voltage: "480V",
      },
    },
  },
  "top-level-mismatch": {
    name: "top-level-mismatch",
    description: "A required top-level field conflicts with submitted evidence.",
    parsedSubmittal: {
      specSection: "23 73 13",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      deviations: [],
    },
    requirementSet: {
      specSection: "23 73 13",
      manufacturer: "Other Manufacturer",
      modelNumber: "AHU-9000",
    },
  },
  "missing-attribute": {
    name: "missing-attribute",
    description: "A required attribute is defined but the parsed submittal does not contain it.",
    parsedSubmittal: {
      specSection: "23 73 13",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      extractedAttributes: {
        voltage: "480V",
      },
      deviations: [],
    },
    requirementSet: {
      specSection: "23 73 13",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      requiredAttributes: {
        airflowCapacity: "12000 CFM",
        voltage: "480V",
      },
    },
  },
  "array-match": {
    name: "array-match",
    description: "Array-valued attributes should match regardless of order and casing.",
    parsedSubmittal: {
      extractedAttributes: {
        certifications: ["UL", "AMCA", "ETL"],
      },
      deviations: [],
    },
    requirementSet: {
      requiredAttributes: {
        certifications: ["etl", "ul", "amca"],
      },
    },
  },
  "declared-deviation": {
    name: "declared-deviation",
    description: "Declared deviations force a deviation_detected result.",
    parsedSubmittal: {
      specSection: "23 73 13",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      deviations: ["Requested substitution for basis-of-design unit."],
    },
    requirementSet: {
      specSection: "23 73 13",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
    },
  },
};

export function getComparisonScenario(
  name: ComparisonScenarioName,
): ComparisonScenario {
  return scenarios[name];
}

export function listComparisonScenarios(): ComparisonScenarioName[] {
  return Object.keys(scenarios) as ComparisonScenarioName[];
}
