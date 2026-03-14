import { dirname, resolve } from "node:path";
import { promises as fs } from "node:fs";

import { runSubmittalWorkflow } from "../src/backend/orchestrator/runWorkflow";
import type { UploadIntakePayload } from "../src/backend/schemas/intake";

async function main() {
  const fixtureArg = process.argv[2];

  if (!fixtureArg) {
    console.error("Usage: npx tsx scripts/run-workflow.ts <fixture-path>");
    process.exit(1);
  }

  const fixturePath = resolve(process.cwd(), fixtureArg);
  const fixtureRoot = dirname(fixturePath);
  const rawFixture = await fs.readFile(fixturePath, "utf-8");
  const payload = JSON.parse(rawFixture) as UploadIntakePayload;

  const result = await runSubmittalWorkflow(payload, {
    fixtureRoot,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
