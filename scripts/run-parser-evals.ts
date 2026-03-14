import { parseSubmittal } from "../src/backend/agents/parser";
import {
  getMockFixture,
  listMockFixtures,
  type MockFixtureName,
} from "../src/backend/demo/mockSubmittals";
import type {
  DetailedParsedSubmittal,
  DocumentFieldName,
  ParsedDocumentType,
  ParserIssue,
} from "../src/backend/schemas/workflow";
import { generateParserFixtures } from "./generate-parser-fixtures";
import {
  parserEvalDefinitions,
  type ParserEvalDefinition,
  type ParserFieldExpectation,
} from "./parser-eval-definitions";

type EvalResult = {
  fixtureName: MockFixtureName;
  passed: boolean;
  hardFailures: string[];
  softFailures: string[];
  hardPassed: number;
  hardTotal: number;
  softPassed: number;
  softTotal: number;
};

function requireApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for parser evals.");
  }
}

function parseModelArg(): string | undefined {
  const index = process.argv.findIndex((arg) => arg === "--model");

  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  if (!value) {
    throw new Error("Missing value for --model");
  }

  return value;
}

function parseFixtureArg(): MockFixtureName[] {
  const fixtureIndex = process.argv.findIndex((arg) => arg === "--fixture");

  if (fixtureIndex === -1) {
    return listMockFixtures();
  }

  const fixtureName = process.argv[fixtureIndex + 1] as MockFixtureName | undefined;
  if (!fixtureName || !listMockFixtures().includes(fixtureName)) {
    throw new Error(`Unknown fixture "${fixtureName ?? ""}".`);
  }

  return [fixtureName];
}

function normalizeValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function compareField(
  fieldName: DocumentFieldName,
  actual: DetailedParsedSubmittal[DocumentFieldName],
  expected: ParserFieldExpectation,
  failures: string[],
): number {
  let passed = 0;
  const actualValue = normalizeValue(actual.value);
  const expectedValue = normalizeValue(expected.value);

  if (actualValue !== expectedValue) {
    failures.push(
      `${fieldName} expected "${expected.value}" but got "${actual.value ?? "null"}".`,
    );
  } else {
    passed += 1;
  }

  if (
    expected.allowedConfidence &&
    !expected.allowedConfidence.includes(actual.confidence)
  ) {
    failures.push(
      `${fieldName} confidence expected one of [${expected.allowedConfidence.join(", ")}] but got "${actual.confidence}".`,
    );
  } else if (expected.allowedConfidence) {
    passed += 1;
  }

  return passed;
}

function compareExactSet(
  label: string,
  actual: string[],
  expected: string[],
  failures: string[],
): number {
  const actualSorted = [...new Set(actual)].sort();
  const expectedSorted = [...new Set(expected)].sort();

  if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    failures.push(
      `${label} expected [${expectedSorted.join(", ")}] but got [${actualSorted.join(", ")}].`,
    );
    return 0;
  }

  return 1;
}

function getIssueCodes(issues: ParserIssue[]): string[] {
  return [...new Set(issues.map((issue) => issue.code))].sort();
}

function compareDocumentTypes(
  parsedSubmittal: DetailedParsedSubmittal,
  expected: ParserEvalDefinition["hard"]["documentTypes"],
  failures: string[],
): number {
  if (!expected || expected.length === 0) {
    return 0;
  }

  let passed = 0;

  for (const item of expected) {
    const actualDocument = parsedSubmittal.documentParses.find(
      (document) => document.documentId === item.documentId,
    );

    if (!actualDocument) {
      failures.push(`Missing parsed document entry for ${item.documentId}.`);
      continue;
    }

    if (actualDocument.documentType !== item.documentType) {
      failures.push(
        `document ${item.documentId} expected type "${item.documentType}" but got "${actualDocument.documentType}".`,
      );
      continue;
    }

    passed += 1;
  }

  return passed;
}

function checkSoftAttributeNames(
  parsedSubmittal: DetailedParsedSubmittal,
  expectedNames: string[],
  failures: string[],
): number {
  if (expectedNames.length === 0) {
    return 0;
  }

  const actualNames = new Set(parsedSubmittal.extractedAttributes.map((attribute) => attribute.name));
  let passed = 0;

  for (const expectedName of expectedNames) {
    if (!actualNames.has(expectedName)) {
      failures.push(`preferred attribute "${expectedName}" was not extracted.`);
      continue;
    }

    passed += 1;
  }

  return passed;
}

function checkSoftIssueCodes(
  parsedSubmittal: DetailedParsedSubmittal,
  expectedCodes: string[],
  failures: string[],
): number {
  if (expectedCodes.length === 0) {
    return 0;
  }

  const actualCodes = new Set(getIssueCodes([...parsedSubmittal.issues, ...parsedSubmittal.deviations]));
  let passed = 0;

  for (const expectedCode of expectedCodes) {
    if (!actualCodes.has(expectedCode)) {
      failures.push(`preferred issue code "${expectedCode}" was not present.`);
      continue;
    }

    passed += 1;
  }

  return passed;
}

function evaluateFixture(
  parsedSubmittal: DetailedParsedSubmittal,
  definition: ParserEvalDefinition,
): EvalResult {
  const hardFailures: string[] = [];
  const softFailures: string[] = [];
  let hardPassed = 0;
  let hardTotal = 1;
  let softPassed = 0;
  let softTotal = 0;

  if (parsedSubmittal.parserSummary.status !== definition.hard.status) {
    hardFailures.push(
      `status expected "${definition.hard.status}" but got "${parsedSubmittal.parserSummary.status}".`,
    );
  } else {
    hardPassed += 1;
  }

  const fields = definition.hard.fields ?? {};
  for (const [fieldName, expectation] of Object.entries(fields) as Array<
    [DocumentFieldName, ParserFieldExpectation]
  >) {
    hardTotal += 1 + (expectation.allowedConfidence ? 1 : 0);
    hardPassed += compareField(
      fieldName,
      parsedSubmittal[fieldName],
      expectation,
      hardFailures,
    );
  }

  if (definition.hard.missingDocuments) {
    hardTotal += 1;
    hardPassed += compareExactSet(
      "missingDocuments",
      parsedSubmittal.missingDocuments,
      definition.hard.missingDocuments,
      hardFailures,
    );
  }

  if (definition.hard.deviationCodes) {
    hardTotal += 1;
    hardPassed += compareExactSet(
      "deviationCodes",
      getIssueCodes(parsedSubmittal.deviations),
      definition.hard.deviationCodes,
      hardFailures,
    );
  }

  if (definition.hard.unresolvedFields) {
    hardTotal += 1;
    hardPassed += compareExactSet(
      "unresolvedFields",
      parsedSubmittal.unresolvedFields,
      definition.hard.unresolvedFields,
      hardFailures,
    );
  }

  if (definition.hard.documentTypes && definition.hard.documentTypes.length > 0) {
    hardTotal += definition.hard.documentTypes.length;
    hardPassed += compareDocumentTypes(
      parsedSubmittal,
      definition.hard.documentTypes,
      hardFailures,
    );
  }

  if (definition.soft?.preferredAttributeNames) {
    softTotal += definition.soft.preferredAttributeNames.length;
    softPassed += checkSoftAttributeNames(
      parsedSubmittal,
      definition.soft.preferredAttributeNames,
      softFailures,
    );
  }

  if (definition.soft?.preferredIssueCodes) {
    softTotal += definition.soft.preferredIssueCodes.length;
    softPassed += checkSoftIssueCodes(
      parsedSubmittal,
      definition.soft.preferredIssueCodes,
      softFailures,
    );
  }

  const allowedSoftFailures = definition.soft?.maxSoftFailures ?? 0;
  const passed = hardFailures.length === 0 && softFailures.length <= allowedSoftFailures;

  return {
    fixtureName: definition.name,
    passed,
    hardFailures,
    softFailures,
    hardPassed,
    hardTotal,
    softPassed,
    softTotal,
  };
}

function printResult(result: EvalResult, description: string): void {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${result.fixtureName}`);
  console.log(description);
  console.log(`Hard checks: ${result.hardPassed}/${result.hardTotal}`);
  if (result.softTotal > 0) {
    console.log(`Soft checks: ${result.softPassed}/${result.softTotal}`);
  }

  for (const failure of result.hardFailures) {
    console.log(`  hard: ${failure}`);
  }

  for (const failure of result.softFailures) {
    console.log(`  soft: ${failure}`);
  }
}

async function main(): Promise<void> {
  requireApiKey();
  await generateParserFixtures();

  const fixtureNames = parseFixtureArg();
  const model = parseModelArg();
  const results: EvalResult[] = [];

  for (const fixtureName of fixtureNames) {
    const fixture = getMockFixture(fixtureName);
    const definition = parserEvalDefinitions[fixtureName];
    const parsedSubmittal = await parseSubmittal(fixture.documents, { model });
    const result = evaluateFixture(parsedSubmittal, definition);

    results.push(result);
    printResult(result, definition.description);
  }

  const passedCount = results.filter((result) => result.passed).length;
  const total = results.length;
  const hardPassed = results.reduce((sum, result) => sum + result.hardPassed, 0);
  const hardTotal = results.reduce((sum, result) => sum + result.hardTotal, 0);
  const softPassed = results.reduce((sum, result) => sum + result.softPassed, 0);
  const softTotal = results.reduce((sum, result) => sum + result.softTotal, 0);

  console.log(`\nSummary: ${passedCount}/${total} fixtures passed`);
  console.log(`Hard checks: ${hardPassed}/${hardTotal}`);
  if (softTotal > 0) {
    console.log(`Soft checks: ${softPassed}/${softTotal}`);
  }

  if (passedCount !== total) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
