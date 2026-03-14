import {
  appendMockInboundEmail,
  getMockInboundInboxPath,
} from "../src/backend/notifications/inboundEmail";

function readOption(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const from = readOption("--from") ?? "jdoe@abcmasonry.com";
  const to = readOption("--to") ?? "submittals@podium.local";
  const subject = readOption("--subject") ?? "Resubmittal with requested documents";
  const text =
    readOption("--text") ?? "Attached are the requested documents for resubmittal.";
  const attachmentPath = readOption("--attachment");

  if (!attachmentPath) {
    console.error(
      "Usage: npm run email:receive -- --attachment <path> [--from <email>] [--to <email>] [--subject <text>] [--text <body>]",
    );
    process.exit(1);
  }

  const fileName = attachmentPath.split("/").at(-1) ?? attachmentPath;
  const mimeType = fileName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : undefined;

  const message = await appendMockInboundEmail({
    from,
    to,
    subject,
    text,
    attachments: [
      {
        fileName,
        path: attachmentPath,
        mimeType,
      },
    ],
  });

  console.log(`Mock inbound inbox: ${getMockInboundInboxPath()}`);
  console.log(JSON.stringify(message, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
