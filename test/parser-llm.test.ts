import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { parseSubmittal } from "../src/backend/agents/parser";
import { MockLlmProvider } from "../src/backend/providers";

test("LLM parser returns package metadata and multi-item package output", async () => {
  const parsedSubmittal = await parseSubmittal(
    [
      {
        documentId: "pdf-01",
        fileName: "perfect.pdf",
        mimeType: "application/pdf",
        filePath: path.resolve(process.cwd(), "test-pdfs/perfect.pdf"),
      },
    ],
    {
      mode: "llm",
      llmProvider: new MockLlmProvider({
        objectHandler: ({ schemaName }) => {
          if (schemaName !== "parser_review") {
            throw new Error(`Unexpected schema: ${schemaName}`);
          }

          return {
            packageMetadata: {
              projectName: {
                value: "Greenfield Office Complex",
                confidence: "high",
                sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
              },
              projectNumber: {
                value: "GOC-2026-001",
                confidence: "high",
                sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
              },
              submittalNumber: {
                value: "SUB-045",
                confidence: "high",
                sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
              },
              requirementReference: {
                value: "SUB-REQ-001",
                confidence: "high",
                sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
              },
              complianceStatement: {
                value: "All materials fully meet or exceed every parameter in Requirement Document SUB-REQ-001.",
                confidence: "high",
                sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
              },
            },
            items: [
              {
                itemId: "cmu",
                label: {
                  value: "Concrete Masonry Units (CMU)",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                productType: {
                  value: "Concrete Masonry Units (CMU)",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                specSection: {
                  value: "04 21 00",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                manufacturer: {
                  value: "Acme Block Co.",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                modelNumber: {
                  value: "Acme Standard CMU",
                  confidence: "medium",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                attributes: [],
                requiredDocuments: ["Product Data", "Test Reports", "MSDS"],
                supportingDocuments: ["Product Data", "Test Reports", "MSDS"],
                confidence: "high",
                sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
              },
              {
                itemId: "mortar",
                label: {
                  value: "Mortar",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                productType: {
                  value: "Mortar",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                specSection: {
                  value: "04 05 13",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                manufacturer: {
                  value: "QuikMix",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                modelNumber: {
                  value: "Type N Mortar",
                  confidence: "high",
                  sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
                },
                attributes: [],
                requiredDocuments: ["Product Data", "MSDS"],
                supportingDocuments: ["Product Data", "MSDS"],
                confidence: "high",
                sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
              },
            ],
            specSection: {
              value: "04 21 00",
              confidence: "high",
              sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
            },
            productType: {
              value: "Concrete Masonry Units (CMU)",
              confidence: "high",
              sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
            },
            manufacturer: {
              value: "Acme Block Co.",
              confidence: "high",
              sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
            },
            modelNumber: {
              value: "Acme Standard CMU",
              confidence: "medium",
              sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
            },
            revision: {
              value: "1",
              confidence: "high",
              sources: [{ documentId: "pdf-01", fileName: "perfect.pdf" }],
            },
            extractedAttributes: [],
            missingDocuments: [],
            requiredDocuments: ["Product Data", "Test Reports", "MSDS"],
            supportingDocuments: ["Product Data", "Test Reports", "MSDS", "Sample Photos"],
            deviations: [],
            issues: [],
            documentAnalyses: [
              {
                documentId: "pdf-01",
                documentType: "product_data",
                summary: "Multi-material masonry compliance submittal.",
                confidence: "high",
              },
            ],
            overallStatus: "parsed",
          };
        },
      }),
    },
  );

  assert.equal(parsedSubmittal.packageMetadata?.projectName.value, "Greenfield Office Complex");
  assert.equal(parsedSubmittal.items?.length, 2);
  assert.equal(parsedSubmittal.items?.[0]?.specSection.value, "04 21 00");
  assert.equal(parsedSubmittal.supportingDocuments?.includes("Sample Photos"), true);
});
