import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";

import { parserFixtureDefinitions } from "./parser-fixture-definitions";

const fixtureRoot = path.resolve(process.cwd(), "scripts/fixtures/generated");

async function ensureDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
}

async function writePdf(outputPath: string, lines: string[]): Promise<void> {
  await ensureDirectory(path.dirname(outputPath));

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: true,
      margin: 48,
      size: "LETTER",
      compress: false,
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", async () => {
      try {
        await writeFile(outputPath, Buffer.concat(chunks));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    doc.on("error", reject);

    doc.font("Helvetica");
    lines.forEach((line, index) => {
      doc.fontSize(index === 0 ? 16 : 12).text(line);
      doc.moveDown(index === 0 ? 1 : 0.4);
    });
    doc.end();
  });
}

async function writeInvalidPdf(outputPath: string, rawText: string): Promise<void> {
  await ensureDirectory(path.dirname(outputPath));
  await writeFile(outputPath, rawText, "utf8");
}

export async function generateParserFixtures(): Promise<void> {
  for (const fixture of parserFixtureDefinitions) {
    const fixtureDirectory = path.join(fixtureRoot, fixture.name);
    await ensureDirectory(fixtureDirectory);

    for (const document of fixture.documents) {
      const outputPath = path.join(fixtureDirectory, document.fileName);

      if (document.invalidPdf) {
        await writeInvalidPdf(outputPath, document.rawText ?? "Invalid PDF fixture");
      } else {
        await writePdf(outputPath, document.lines ?? []);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateParserFixtures().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
