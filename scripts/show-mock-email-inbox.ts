import { readMockInbox, getMockInboxPath } from "../src/backend/notifications/email";

async function main(): Promise<void> {
  const messages = await readMockInbox();

  console.log(`Mock inbox: ${getMockInboxPath()}`);
  console.log(`Messages: ${messages.length}`);
  console.log(JSON.stringify(messages, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
