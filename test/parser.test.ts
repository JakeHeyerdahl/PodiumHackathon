import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { before } from "node:test";

import { generateParserFixtures } from "../scripts/generate-parser-fixtures";
import { stableJsonStringify } from "../scripts/stable-json";
import { parseSubmittal } from "../src/backend/agents/parser";
import { getMockFixture, listMockFixtures } from "../src/backend/demo/mockSubmittals";

before(async () => {
  await generateParserFixtures();
});

test("good-submittal extracts the core fields", async () => {
  const fixture = getMockFixture("good-submittal");
  const parsedSubmittal = await parseSubmittal(fixture.documents);

  assert.equal(parsedSubmittal.specSection.value, "23 73 13");
  assert.equal(parsedSubmittal.productType.value, "Packaged Indoor Air Handling Unit");
  assert.equal(parsedSubmittal.manufacturer.value, "Acme Air Systems");
  assert.equal(parsedSubmittal.modelNumber.value, "AHU-9000");
  assert.equal(parsedSubmittal.revision.value, "B");
  assert.equal(parsedSubmittal.parserSummary.status, "parsed");
  assert.equal(parsedSubmittal.unresolvedFields.length, 0);
});

test("missing-doc-submittal reports a missing warranty", async () => {
  const fixture = getMockFixture("missing-doc-submittal");
  const parsedSubmittal = await parseSubmittal(fixture.documents);

  assert(parsedSubmittal.missingDocuments.includes("warranty"));
  assert.equal(parsedSubmittal.parserSummary.status, "parsed_with_warnings");
});

test("deviation-submittal records explicit deviation language", async () => {
  const fixture = getMockFixture("deviation-submittal");
  const parsedSubmittal = await parseSubmittal(fixture.documents);

  assert(parsedSubmittal.deviations.length > 0);
  assert(
    parsedSubmittal.deviations.some((issue) => issue.code === "deviation_detected"),
  );
});

test("conflict-submittal resolves conflicting values with precedence", async () => {
  const fixture = getMockFixture("conflict-submittal");
  const parsedSubmittal = await parseSubmittal(fixture.documents);

  assert.equal(parsedSubmittal.modelNumber.value, "AHU-9000");
  assert.equal(parsedSubmittal.revision.value, "B");
  assert(
    parsedSubmittal.issues.some((issue) => issue.code === "conflicting_values"),
  );
});

test("scan-review-submittal flags low-text PDFs for review", async () => {
  const fixture = getMockFixture("scan-review-submittal");
  const parsedSubmittal = await parseSubmittal(fixture.documents);

  assert.equal(parsedSubmittal.parserSummary.status, "needs_human_review");
  assert(
    parsedSubmittal.documentParses.some(
      (document) => document.extractionStatus === "ocr_required",
    ),
  );
});

test("malformed-submittal returns structured document failure", async () => {
  const fixture = getMockFixture("malformed-submittal");
  const parsedSubmittal = await parseSubmittal(fixture.documents);

  assert.equal(parsedSubmittal.parserSummary.status, "needs_human_review");
  assert(
    parsedSubmittal.documentParses.some((document) =>
      document.issues.some((issue) => issue.code === "pdf_load_failed"),
    ),
  );
});

for (const fixtureName of listMockFixtures()) {
  test(`${fixtureName} snapshot stays stable`, async () => {
    const fixture = getMockFixture(fixtureName);
    const parsedSubmittal = await parseSubmittal(fixture.documents, {
      reviewedAt: "2026-01-01T00:00:00.000Z",
    });
    const expected = await readFile(fixture.expectedSnapshotPath, "utf8");

    assert.equal(`${stableJsonStringify(parsedSubmittal)}\n`, expected);
  });
}
