import { mkdir, readFile, rm, appendFile } from "node:fs/promises";
import path from "node:path";

export type EmailDeliveryResult =
  | {
      status: "sent";
      provider: "mock";
      recipient: string;
      messageId?: string;
      mailboxPath: string;
    }
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "failed";
      reason: string;
      recipient?: string;
    };

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type MockInboxMessage = {
  id: string;
  receivedAt: string;
  to: string;
  subject: string;
  text: string;
};

export function getMockInboxPath(): string {
  const configuredPath = process.env.MOCK_EMAIL_INBOX_PATH?.trim();
  return configuredPath
    ? path.resolve(configuredPath)
    : path.resolve(process.cwd(), "tmp", "mock-email-inbox.jsonl");
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<EmailDeliveryResult> {
  const mailboxPath = getMockInboxPath();
  const message: MockInboxMessage = {
    id: `mock-email-${Date.now()}`,
    receivedAt: new Date().toISOString(),
    to: input.to,
    subject: input.subject,
    text: input.text,
  };

  try {
    await mkdir(path.dirname(mailboxPath), { recursive: true });
    await appendFile(mailboxPath, `${JSON.stringify(message)}\n`, "utf8");
    return {
      status: "sent",
      provider: "mock",
      recipient: input.to,
      messageId: message.id,
      mailboxPath,
    };
  } catch (error) {
    return {
      status: "failed",
      recipient: input.to,
      reason: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}

export async function readMockInbox(
  mailboxPath = getMockInboxPath(),
): Promise<MockInboxMessage[]> {
  try {
    const content = await readFile(mailboxPath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MockInboxMessage);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

export async function clearMockInbox(
  mailboxPath = getMockInboxPath(),
): Promise<void> {
  await rm(mailboxPath, { force: true });
}
