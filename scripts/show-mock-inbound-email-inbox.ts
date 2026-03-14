import {
  getMockInboundInboxPath,
  readMockInboundInbox,
} from "../src/backend/notifications/inboundEmail";

async function main(): Promise<void> {
  const messages = await readMockInboundInbox();

  console.log(`Mock inbound inbox: ${getMockInboundInboxPath()}`);
  console.log(`Messages: ${messages.length}`);
  console.log(JSON.stringify(messages, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
