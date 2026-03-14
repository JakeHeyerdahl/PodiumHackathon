import assert from "node:assert/strict";
import test from "node:test";

import { parseSubmittalDeterministic } from "../src/backend/agents/parser";
import {
  getRealSubmittalFixture,
  getRequirementDocument,
} from "../src/backend/demo/realPdfFixtures";

test("perfect.pdf resolves the masonry package to the CMU row", async () => {
  const fixture = getRealSubmittalFixture("perfect");
  const parsedSubmittal = await parseSubmittalDeterministic([fixture.document]);

  assert.equal(parsedSubmittal.specSection.value, "04 21 00");
  assert.equal(parsedSubmittal.productType.value, "Concrete Masonry Units (CMU)");
  assert.equal(parsedSubmittal.manufacturer.value, "Acme Block Co.");
  assert.equal(parsedSubmittal.modelNumber.value, "ACME STANDARD CMU");
  assert.equal(parsedSubmittal.revision.value, "1");
  assert.equal(parsedSubmittal.parserSummary.status, "parsed_with_warnings");
});

test("submittal-1.pdf resolves the primary CMU identity fields from the material table", async () => {
  const fixture = getRealSubmittalFixture("submittal-1");
  const parsedSubmittal = await parseSubmittalDeterministic([fixture.document]);

  assert.equal(parsedSubmittal.specSection.value, "04 21 00");
  assert.equal(parsedSubmittal.productType.value, "Concrete Masonry Units (CMU)");
  assert.equal(parsedSubmittal.manufacturer.value, "Acme Block Co.");
  assert.equal(parsedSubmittal.modelNumber.value, "ACME STANDARD CMU, 8X8X16");
  assert.equal(parsedSubmittal.parserSummary.status, "needs_human_review");
});

test("busted.pdf remains an unresolved package with unknown document type", async () => {
  const fixture = getRealSubmittalFixture("busted");
  const parsedSubmittal = await parseSubmittalDeterministic([fixture.document]);

  assert.equal(parsedSubmittal.specSection.value, null);
  assert.equal(parsedSubmittal.documentParses[0]?.documentType, "unknown");
  assert.equal(parsedSubmittal.parserSummary.status, "needs_human_review");
  assert(parsedSubmittal.missingDocuments.includes("product_data"));
});

test("requirement-1.pdf should not be flagged as a declared deviation", async () => {
  const parsedSubmittal = await parseSubmittalDeterministic([getRequirementDocument()]);

  assert.equal(parsedSubmittal.deviations.length, 0);
  assert.equal(
    parsedSubmittal.issues.some((issue) => issue.code === "deviation_detected"),
    false,
  );
});
