import { describe, expect, it } from "vitest";
import { foldTr, matchScore, rankItems } from "./search";

describe("Türkçe canlı arama", () => {
  it("harf ve büyük/küçük farkını gözetmez", () => {
    expect(foldTr("ÖZYIL İŞ Çığ ÜĞ")).toBe("ozyil is cig ug");
    expect(matchScore("OZ", ["Özyıl"])).toBe(0);
  });
  it("baştan eşleşeni öne alır", () => {
    expect(rankItems(["Akın Özdemir", "Özyıl", "Ayşe Öz", "Beksada"], "öz", (f) => [f])).toEqual(["Özyıl", "Akın Özdemir", "Ayşe Öz"]);
  });
  it("boş arama tümünü döndürür, eşleşmeyen elenir", () => {
    expect(rankItems(["A", "B"], "", (f) => [f])).toHaveLength(2);
    expect(rankItems(["A", "B"], "z", (f) => [f])).toHaveLength(0);
  });
});
