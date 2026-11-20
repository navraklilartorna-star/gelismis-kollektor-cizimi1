// @vitest-environment node
import { readFile } from "node:fs/promises";
import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { newProject } from "./collector";
import { makePdf } from "./pdf";

describe("customer PDF", () => {
  it("creates a diagram and paginated manufacturing list for each collector in one PDF", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("fetch", async (url: string) => ({ arrayBuffer: async () => {
      const bytes = await readFile(`public${url}`);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }, ok: true }));
    try {
      const first = { ...newProject(), customerName: "Ahmet Bey", name: "Sera 1", notes: "Kaynaklar kontrol edilecek." };
      const second = { ...newProject(), customerName: "Ahmet Bey", name: "Sera 2", count: 9 };
      const pdf = await makePdf([first, second]);
      const doc = await PDFDocument.load(await pdf.arrayBuffer());
      expect(doc.getPageCount()).toBe(2);
      expect(doc.getTitle()).toBe("Ahmet Bey");
      const single = await PDFDocument.load(await (await makePdf(first)).arrayBuffer());
      expect(single.getPageCount()).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});