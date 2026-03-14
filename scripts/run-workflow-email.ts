import path from "node:path";

import { runSubmittalWorkflow } from "../src/backend/orchestrator/runWorkflow";
import {
  getLatestMockInboundEmail,
  getMockInboundEmailById,
  getMockInboundInboxPath,
  toFixtureDocuments,
} from "../src/backend/notifications/inboundEmail";
import type { UploadIntakePayload } from "../src/backend/schemas/intake";
import { loadLocalEnv } from "./load-local-env";

function readOption(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  loadLocalEnv(".env");
  loadLocalEnv();

  const emailId = readOption("--email-id");
  const projectName = readOption("--project") ?? "Email Intake Workflow";
  const mailboxPath = readOption("--mailbox") ?? getMockInboundInboxPath();
  const fixtureRoot = process.cwd();

  const message = emailId
    ? await getMockInboundEmailById(emailId, mailboxPath)
    : await getLatestMockInboundEmail(mailboxPath);

  if (!message) {
    console.error(
      `No mock inbound email found in ${path.resolve(mailboxPath)}${emailId ? ` for id ${emailId}` : ""}.`,
    );
    process.exit(1);
  }

  const payload: UploadIntakePayload = {
    projectName,
    sourceType: "email",
    emailId: message.id,
    mailboxPath,
    documents: toFixtureDocuments(message),
  };

  const result = await runSubmittalWorkflow(payload, {
    fixtureRoot,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
