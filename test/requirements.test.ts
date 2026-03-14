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
