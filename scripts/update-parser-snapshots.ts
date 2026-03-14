import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseSubmittalDeterministic } from "../src/backend/agents/parser";
import { getMockFixture, listMockFixtures } from "../src/backend/demo/mockSubmittals";
import { generateParserFixtures } from "./generate-parser-fixtures";
import { stableJsonStringify } from "./stable-json";

const expectedRoot = path.resolve(process.cwd(), "scripts/fixtures/expected");

async function main(): Promise<void> {
  await generateParserFixtures();
  await mkdir(expectedRoot, { recursive: true });

  for (const fixtureName of listMockFixtures()) {
    const fixture = getMockFixture(fixtureName);
    const parsedSubmittal = await parseSubmittalDeterministic(fixture.documents, {
      reviewedAt: "2026-01-01T00:00:00.000Z",
    });
    await writeFile(
      fixture.expectedSnapshotPath,
      `${stableJsonStringify(parsedSubmittal)}\n`,
      "utf8",
    );
    console.log(`Updated ${fixtureName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
