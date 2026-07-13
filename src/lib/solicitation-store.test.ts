import { describe, expect, it } from "vitest";
import {
  buildDocumentQueueForOffer,
  deriveSolicitationDocumentName,
  replaceSolicitationPacket,
  getSolicitationPacket,
} from "./solicitation-store";
import { DOCUMENT_QUEUE } from "./mock-data";

describe("solicitation packet documents", () => {
  it("keeps the MAS document queue for GSA MAS offers", () => {
    expect(buildDocumentQueueForOffer("gsa_mas", [])).toEqual(DOCUMENT_QUEUE);
  });

  it("replaces the MAS document queue with solicitation packet files for non-GSA offers", () => {
    const queue = buildDocumentQueueForOffer("gwac_rfp", [
      {
        id: "file-1",
        filename: "Section-L-Instructions.pdf",
        mediaType: "application/pdf",
        size: 1200,
        uploadedAt: 1,
      },
      {
        id: "file-2",
        filename: "Pricing_Form.xlsx",
        mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 900,
        uploadedAt: 2,
      },
    ]);

    expect(queue.map((item) => item.name)).toEqual(["Section L Instructions", "Pricing Form"]);
    expect(queue).not.toEqual(DOCUMENT_QUEUE);
  });

  it("stores packet files per offer", () => {
    replaceSolicitationPacket("offer-1", [
      {
        filename: "Attachment_J-1.docx",
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 2400,
      },
    ]);

    expect(getSolicitationPacket("offer-1").files[0]).toMatchObject({
      filename: "Attachment_J-1.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 2400,
    });
    expect(getSolicitationPacket("offer-2").files).toEqual([]);
  });
});

describe("deriveSolicitationDocumentName", () => {
  it("turns filenames into readable document names", () => {
    expect(deriveSolicitationDocumentName("VA-FSS_Form_123.pdf")).toBe("VA FSS Form 123");
  });
});
