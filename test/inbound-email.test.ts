import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { runIntakeAgent } from "../src/backend/agents/intake";
import {
  appendMockInboundEmail,
  clearMockInboundInbox,
  getLatestMockInboundEmail,
  readMockInboundInbox,
} from "../src/backend/notifications/inboundEmail";

test("mock inbound email can be received and converted into intake documents", async () => {
  const mailboxPath = path.resolve(
    process.cwd(),
    "tmp",
    "mock-inbound-email-inbox.test.jsonl",
  );
  process.env.MOCK_INBOUND_EMAIL_INBOX_PATH = mailboxPath;
  await clearMockInboundInbox(mailboxPath);

  const message = await appendMockInboundEmail({
    from: "jdoe@abcmasonry.com",
    to: "submittals@podium.local",
    subject: "Requested resubmittal",
    text: "Attached are the requested shop drawings.",
    attachments: [
      {
        fileName: "perfect.pdf",
        path: "test-pdfs/perfect.pdf",
        mimeType: "application/pdf",
      },
    ],
  });

  const messages = await readMockInboundInbox(mailboxPath);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.id, message.id);

  const latest = await getLatestMockInboundEmail(mailboxPath);
  assert.equal(latest?.id, message.id);

  const intakeResult = await runIntakeAgent(
    {
      projectName: "Email Intake Test",
      sourceType: "email",
      emailId: message.id,
      mailboxPath,
    },
    process.cwd(),
  );

  assert.equal(intakeResult.status, "accepted");
  assert.equal(intakeResult.envelope?.sourceType, "email");
  assert.equal(intakeResult.envelope?.documents.length, 1);
  assert.equal(intakeResult.envelope?.documents[0]?.fileName, "perfect.pdf");
  assert.match(intakeResult.envelope?.documents[0]?.fullText ?? "", /Project Name:/);
});
