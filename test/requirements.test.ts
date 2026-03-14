import assert from "node:assert/strict";
import test from "node:test";

import { buildRequirementSet } from "../src/backend/agents/requirements";

test("buildRequirementSet uses safe defaults when no project context is available", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Tower",
    submittalTitle: "AHU Product Data",
    parsedSubmittal: {},
  });

  assert.equal(requirementSet.specSection.value, "UNSPECIFIED");
  assert.deepEqual(requirementSet.specSection.sources, ["default_policy"]);
  assert.deepEqual(
    requirementSet.requiredAttributes.map((attribute) => attribute.key),
    ["manufacturer", "modelNumber"],
  );
  assert.deepEqual(
    requirementSet.requiredDocuments.map((document) => document.key),
    ["product_data", "shop_drawings"],
  );
  assert.match(
    requirementSet.assumptions.join(" "),
    /baseline demo requirements were used/i,
  );
});

test("buildRequirementSet derives spec section and title requirements from matching title hints", () => {
  const requirementSet = buildRequirementSet({
    projectName: "North Plant",
    submittalTitle: "Fire Smoke Damper Package",
    parsedSubmittal: {
      productType: "Damper",
    },
    mockProjectRequirementContext: {
      titleHints: {
        smoke_damper: {
          specSection: "23 33 46",
          requiredDocuments: [
            {
              key: "ul_listing",
              label: "UL Listing",
            },
          ],
          rationale: "Smoke damper submittals require code listing evidence.",
        },
      },
    },
  });

  assert.equal(requirementSet.specSection.value, "23 33 46");
  assert.deepEqual(requirementSet.specSection.sources, [
    "submittal_title_inference",
  ]);
  assert(
    requirementSet.requiredDocuments.some(
      (document) =>
        document.key === "ul_listing" &&
        document.sources.includes("submittal_title_inference"),
    ),
  );
  assert(
    requirementSet.assumptions.some((assumption) =>
      assumption.includes("Spec section was inferred from the submittal title"),
    ),
  );
});

test("buildRequirementSet merges spec, product, and parsed identity requirements", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Civic Center",
    submittalTitle: "Indoor AHU Review",
    parsedSubmittal: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
    },
    mockProjectRequirementContext: {
      defaultSpecSection: "00 00 00",
      specSections: {
        "23 73 13": {
          requiredAttributes: [
            {
              key: "airflow",
              label: "Airflow",
              expectedValue: 4000,
            },
          ],
          requiredDocuments: [
            {
              key: "wiring_diagram",
              label: "Wiring Diagram",
            },
          ],
          routingPolicy: {
            completeDestination: "human_exception_queue",
          },
          rationale: "AHU sections need electrical review support.",
        },
      },
      productTypeRequirements: {
        packaged_indoor_air_handling_unit: {
          requiredAttributes: [
            {
              key: "voltage",
              label: "Voltage",
              allowedValues: [460, 480],
            },
          ],
          requiredDocuments: [
            {
              key: "startup_procedure",
              label: "Startup Procedure",
            },
          ],
          rationale: "Packaged units need startup sequence review.",
        },
      },
      routingPolicy: {
        deviationDestination: "return_to_subcontractor",
        escalationTriggers: ["controls integration hold point"],
      },
    },
  });

  assert.equal(requirementSet.specSection.value, "23 73 13");
  assert.deepEqual(requirementSet.specSection.sources, ["parsed_submittal"]);

  const manufacturer = requirementSet.requiredAttributes.find(
    (attribute) => attribute.key === "manufacturer",
  );
  const modelNumber = requirementSet.requiredAttributes.find(
    (attribute) => attribute.key === "modelNumber",
  );
  const airflow = requirementSet.requiredAttributes.find(
    (attribute) => attribute.key === "airflow",
  );
  const voltage = requirementSet.requiredAttributes.find(
    (attribute) => attribute.key === "voltage",
  );

  assert.equal(manufacturer?.expectedValue, "Acme Air Systems");
  assert(manufacturer?.sources.includes("parsed_submittal"));
  assert.equal(modelNumber?.expectedValue, "AHU-9000");
  assert.equal(airflow?.expectedValue, 4000);
  assert.deepEqual(voltage?.allowedValues, [460, 480]);
  assert.deepEqual(
    requirementSet.requiredDocuments.map((document) => document.key),
    [
      "product_data",
      "shop_drawings",
      "startup_procedure",
      "wiring_diagram",
    ],
  );
  assert.equal(
    requirementSet.routingPolicy.completeDestination,
    "human_exception_queue",
  );
  assert.equal(
    requirementSet.routingPolicy.deviationDestination,
    "return_to_subcontractor",
  );
  assert(
    requirementSet.routingPolicy.escalationTriggers.includes(
      "controls integration hold point",
    ),
  );
});

test("buildRequirementSet uses project defaults when no parsed spec section is present", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Library Annex",
    submittalTitle: "General Controls Package",
    parsedSubmittal: {},
    mockProjectRequirementContext: {
      defaultSpecSection: "25 00 00",
    },
  });

  assert.equal(requirementSet.specSection.value, "25 00 00");
  assert.deepEqual(requirementSet.specSection.sources, ["mock_project_context"]);
  assert.equal(requirementSet.assumptions.length, 0);
});

test("requirements agent uses parsed spec section and baseline defaults without context", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: "AHU Submittal",
    parsedSubmittal: {
      specSection: "23 73 13",
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      revision: "B",
      extractedAttributes: null,
      missingDocuments: [],
      deviations: [],
    },
  });

  assert.equal(requirementSet.specSection.value, "23 73 13");
  assert.deepEqual(requirementSet.specSection.sources, ["parsed_submittal"]);
  assert.equal(
    requirementSet.routingPolicy.completeDestination,
    "auto_route_internal_review",
  );
  assert(
    requirementSet.requiredDocuments.some(
      (document) => document.key === "product_data" && document.required,
    ),
  );
  assert(
    requirementSet.requiredDocuments.some(
      (document) => document.key === "shop_drawings" && document.required,
    ),
  );
  assert(
    requirementSet.requiredAttributes.some(
      (attribute) =>
        attribute.key === "manufacturer" &&
        attribute.expectedValue === "Acme Air Systems" &&
        attribute.sources.includes("parsed_submittal"),
    ),
  );
  assert(
    requirementSet.requiredAttributes.some(
      (attribute) =>
        attribute.key === "modelNumber" &&
        attribute.expectedValue === "AHU-9000" &&
        attribute.sources.includes("parsed_submittal"),
    ),
  );
  assert(
    requirementSet.assumptions.includes(
      "No mock project requirement context was provided, so baseline demo requirements were used.",
    ),
  );
});

test("requirements agent infers spec section from title hints and merges project context", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: "AHU 9000 indoor air handler package",
    parsedSubmittal: {
      productType: "Packaged Indoor Air Handling Unit",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      extractedAttributes: null,
      missingDocuments: [],
      deviations: [],
    },
    mockProjectRequirementContext: {
      defaultSpecSection: "99 99 99",
      routingPolicy: {
        completeDestination: "human_exception_queue",
        escalationTriggers: ["project default trigger"],
      },
      titleHints: {
        "air handler": {
          specSection: "23 73 13",
          requiredDocuments: [
            {
              key: "warranty",
              label: "Warranty",
              required: true,
            },
          ],
          rationale: "Air handler titles map to the AHU specification section.",
        },
      },
      specSections: {
        "23 73 13": {
          requiredAttributes: [
            {
              key: "airflow_capacity",
              label: "Airflow Capacity",
              expectedValue: "12000 CFM",
              required: true,
            },
          ],
          requiredDocuments: [
            {
              key: "operations_manual",
              label: "Operations Manual",
              required: true,
            },
          ],
          routingPolicy: {
            completeDestination: "auto_route_internal_review",
            deviationDestination: "human_exception_queue",
            escalationTriggers: ["spec trigger"],
          },
          rationale: "Spec-specific AHU requirements apply.",
        },
      },
      productTypeRequirements: {
        packaged_indoor_air_handling_unit: {
          requiredAttributes: [
            {
              key: "finish_color",
              label: "Finish Color",
              expectedValue: "Gray",
              required: false,
            },
          ],
          requiredDocuments: [
            {
              key: "shop_drawings",
              label: "Shop Drawings",
              required: true,
            },
          ],
          rationale: "AHU product-type requirements add accessory expectations.",
        },
      },
    },
  });

  assert.equal(requirementSet.specSection.value, "23 73 13");
  assert.deepEqual(requirementSet.specSection.sources, ["submittal_title_inference"]);
  assert(
    requirementSet.assumptions.includes(
      "Spec section was inferred from the submittal title as 23 73 13.",
    ),
  );
  assert.equal(
    requirementSet.routingPolicy.completeDestination,
    "auto_route_internal_review",
  );
  assert(
    requirementSet.routingPolicy.escalationTriggers.includes("project default trigger"),
  );
  assert(
    requirementSet.routingPolicy.escalationTriggers.includes("spec trigger"),
  );
  assert(
    requirementSet.requiredDocuments.some(
      (document) =>
        document.key === "warranty" &&
        document.sources.includes("submittal_title_inference"),
    ),
  );
  assert(
    requirementSet.requiredDocuments.some(
      (document) =>
        document.key === "operations_manual" &&
        document.sources.includes("mock_project_context"),
    ),
  );
  assert(
    requirementSet.requiredAttributes.some(
      (attribute) =>
        attribute.key === "airflowCapacity" &&
        attribute.expectedValue === "12000 CFM",
    ),
  );
  assert(
    requirementSet.requiredAttributes.some(
      (attribute) =>
        attribute.key === "finishColor" &&
        attribute.expectedValue === "Gray",
    ),
  );
});

test("requirements agent falls back to default spec section when no parsed or title evidence exists", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: "Unlabeled equipment package",
    parsedSubmittal: {
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      extractedAttributes: null,
      missingDocuments: [],
      deviations: [],
    },
    mockProjectRequirementContext: {
      defaultSpecSection: "26 05 00",
    },
  });

  assert.equal(requirementSet.specSection.value, "26 05 00");
  assert.deepEqual(requirementSet.specSection.sources, ["mock_project_context"]);
  assert.equal(
    requirementSet.assumptions.includes(
      "Spec section could not be resolved, so the requirement set remains generic for safe comparison.",
    ),
    false,
  );
});

test("requirements agent preserves existing expected values from context over parsed seeding", () => {
  const requirementSet = buildRequirementSet({
    projectName: "Demo Project",
    submittalTitle: "AHU package",
    parsedSubmittal: {
      specSection: "23 73 13",
      manufacturer: "Acme Air Systems",
      modelNumber: "AHU-9000",
      extractedAttributes: null,
      missingDocuments: [],
      deviations: [],
    },
    mockProjectRequirementContext: {
      specSections: {
        "23 73 13": {
          requiredAttributes: [
            {
              key: "manufacturer",
              expectedValue: "Basis of Design Manufacturer",
            },
            {
              key: "model_number",
              expectedValue: "BOD-1234",
            },
          ],
        },
      },
    },
  });

  assert(
    requirementSet.requiredAttributes.some(
      (attribute) =>
        attribute.key === "manufacturer" &&
        attribute.expectedValue === "Basis of Design Manufacturer",
    ),
  );
  assert(
    requirementSet.requiredAttributes.some(
      (attribute) =>
        attribute.key === "modelNumber" &&
        attribute.expectedValue === "BOD-1234",
    ),
  );
});
