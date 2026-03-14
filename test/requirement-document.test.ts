import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildRequirementSet,
  parseRequirementDocument,
} from "../src/backend/agents/requirements";
import { MockLlmProvider } from "../src/backend/providers";

test("requirement PDF parser extracts multi-item requirements from requirement-1.pdf", async () => {
  const parsedRequirementDocument = await parseRequirementDocument({
    document: {
      documentId: "requirement-01",
      fileName: "requirement-1.pdf",
      mimeType: "application/pdf",
      filePath: path.resolve(process.cwd(), "test-pdfs/requirement-1.pdf"),
    },
    llmProvider: new MockLlmProvider({
      objectHandler: ({ schemaName }) => {
        if (schemaName !== "requirement_document_review") {
          throw new Error(`Unexpected schema: ${schemaName}`);
        }

        return {
          metadata: {
            projectName: "Greenfield Office Complex",
            projectNumber: "GOC-2026-001",
            requirementDocumentId: "SUB-REQ-001",
            specSection: null,
            confidence: "high",
            sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
          },
          items: [
            {
              itemId: "cmu",
              label: "Concrete Masonry Units (CMU)",
              productType: "Concrete Masonry Units (CMU)",
              specSection: "04 21 00",
              manufacturerRequirement: "Acme Block Co.",
              modelNumberRequirement: "Standard CMU, 8x8x16",
              attributes: [
                {
                  key: "compressive_strength",
                  label: "Compressive Strength",
                  expectedValue: 1900,
                  allowedValues: [],
                  required: true,
                  rationale: "Minimum strength requirement.",
                  sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
                },
              ],
              requiredDocuments: [
                {
                  key: "product_data",
                  label: "Manufacturer product data sheets",
                  required: true,
                  sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
                },
              ],
              rationale: "CMU requirements for approval.",
              sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
            },
          ],
          requiredDocuments: [
            {
              key: "product_data",
              label: "Manufacturer product data sheets",
              required: true,
              sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
            },
            {
              key: "test_reports",
              label: "Factory certifications / test reports",
              required: true,
              sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
            },
          ],
          deviationPolicy: {
            substitutionsRequireApproval: true,
            deviationsRequireApproval: true,
            summary: "Any substitution or deviation must be submitted for approval.",
          },
          assumptions: [],
        };
      },
    }),
  });

  assert.equal(parsedRequirementDocument.metadata.requirementDocumentId, "SUB-REQ-001");
  assert.equal(parsedRequirementDocument.items[0]?.specSection, "04 21 00");

  const requirementSet = buildRequirementSet({
    projectName: "Greenfield Office Complex",
    submittalTitle: "SUB-045",
    parsedSubmittal: {},
    parsedRequirementDocument,
  });

  assert.equal(requirementSet.requirementDocumentReference, "SUB-REQ-001");
  assert.equal(requirementSet.requiredItems?.length, 1);
  assert(
    requirementSet.requiredDocuments.some(
      (document) => document.label === "Factory certifications / test reports",
    ),
  );
});
