import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import type { RawFixtureDocument } from "../schemas/intake";

export type MockInboundEmailAttachment = {
  fileName: string;
  path: string;
  mimeType?: string;
};

export type MockInboundEmail = {
  id: string;
  receivedAt: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: MockInboundEmailAttachment[];
};

export function getMockInboundInboxPath(): string {
  const configuredPath = process.env.MOCK_INBOUND_EMAIL_INBOX_PATH?.trim();
  return configuredPath
    ? path.resolve(configuredPath)
    : path.resolve(process.cwd(), "tmp", "mock-inbound-email-inbox.jsonl");
}

export async function appendMockInboundEmail(
  message: Omit<MockInboundEmail, "id" | "receivedAt">,
  mailboxPath = getMockInboundInboxPath(),
): Promise<MockInboundEmail> {
  const nextMessage: MockInboundEmail = {
    id: `mock-inbound-${Date.now()}`,
    receivedAt: new Date().toISOString(),
    ...message,
  };

  await mkdir(path.dirname(mailboxPath), { recursive: true });
  await appendFile(mailboxPath, `${JSON.stringify(nextMessage)}\n`, "utf8");
  return nextMessage;
}

export async function readMockInboundInbox(
  mailboxPath = getMockInboundInboxPath(),
): Promise<MockInboundEmail[]> {
  try {
    const content = await readFile(mailboxPath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MockInboundEmail);
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

export async function clearMockInboundInbox(
  mailboxPath = getMockInboundInboxPath(),
): Promise<void> {
  await rm(mailboxPath, { force: true });
}

export async function getMockInboundEmailById(
  emailId: string,
  mailboxPath = getMockInboundInboxPath(),
): Promise<MockInboundEmail | undefined> {
  const messages = await readMockInboundInbox(mailboxPath);
  return messages.find((message) => message.id === emailId);
}

export async function getLatestMockInboundEmail(
  mailboxPath = getMockInboundInboxPath(),
): Promise<MockInboundEmail | undefined> {
  const messages = await readMockInboundInbox(mailboxPath);
  return messages.at(-1);
}

export function toFixtureDocuments(
  message: MockInboundEmail,
): RawFixtureDocument[] {
  return message.attachments.map((attachment) => ({
    fileName: attachment.fileName,
    path: attachment.path,
    mimeType: attachment.mimeType,
  }));
}
