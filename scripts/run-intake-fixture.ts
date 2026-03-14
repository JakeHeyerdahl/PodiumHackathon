import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

import { runIntakeAgent } from "../src/backend/agents/intake";
import type { UploadIntakePayload } from "../src/backend/schemas/intake";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function printSummary(result: Awaited<ReturnType<typeof runIntakeAgent>>) {
  console.log(`${result.status}: ${result.summary}`);
  if (!result.envelope) {
    return;
  }

  for (const document of result.envelope.documents) {
    const warningSuffix =
      document.warnings && document.warnings.length > 0
        ? ` | warnings: ${document.warnings.join("; ")}`
        : "";
    console.log(
      `- ${document.fileName} | ${document.extractionStatus} | chars: ${
        document.fullText?.length ?? 0
      }${warningSuffix}`,
    );
  }
}

async function main() {
  const fixtureArg = process.argv[2];
  const summaryOnly = process.argv.includes("--summary");

  if (!fixtureArg) {
    console.error("Usage: npx tsx scripts/run-intake-fixture.ts <fixture-path> [--summary]");
    process.exit(1);
  }

  const fixturePath = resolve(process.cwd(), fixtureArg);
  const fixtureRoot = dirname(fixturePath);
  const rawFixture = await fs.readFile(fixturePath, "utf-8");
  const payload = JSON.parse(rawFixture) as UploadIntakePayload;

  const result = await runIntakeAgent(payload, fixtureRoot);

  if (summaryOnly) {
    printSummary(result);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  if (result.status === "rejected") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
