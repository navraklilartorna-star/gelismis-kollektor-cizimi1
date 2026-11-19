/** Türkçe duyarlı canlı arama: İ/ı, büyük-küçük harf ve aksan farkı gözetilmez ("ozyil" → "Özyıl"). */
export function foldTr(value: string): string {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}

/**
 * Eşleşme puanı (düşük = önce): 0 = alan yazılanla başlıyor, 1 = alanın bir kelimesi yazılanla başlıyor,
 * 2 = yazılanı içeriyor, 3 = yalnızca ikincil alanlarda var, null = eşleşme yok. Boş arama her şeyi 0 sayar.
 * Birden çok kelime yazılırsa hepsi eşleşmelidir.
 */
export function matchScore(query: string, primary: string[], secondary: string[] = []): number | null {
  const terms = foldTr(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  const score = (fields: string[]): number | null => {
    const hay = fields.map(foldTr);
    const whole = terms.join(" ");
    if (hay.some((h) => h.startsWith(whole))) return 0;
    const every = (test: (h: string, t: string) => boolean) => terms.every((t) => hay.some((h) => test(h, t)));
    if (every((h, t) => h.startsWith(t) || h.includes(` ${t}`))) return 1;
    if (every((h, t) => h.includes(t))) return 2;
    return null;
  };
  const p = score(primary);
  if (p !== null) return p;
  return secondary.length && score([...primary, ...secondary]) !== null ? 3 : null;
}

/** Puana göre süzer ve sıralar (eşit puanda Türkçe alfabetik); boş aramada sırayı değiştirmez. */
export function rankItems<T>(items: T[], query: string, primary: (x: T) => string[], secondary: (x: T) => string[] = () => []): T[] {
  if (!foldTr(query).trim()) return items;
  return items.flatMap((x) => { const s = matchScore(query, primary(x), secondary(x)); return s === null ? [] : [{ x, s, k: primary(x)[0] ?? "" }]; })
    .sort((a, b) => a.s - b.s || a.k.localeCompare(b.k, "tr-TR")).map((e) => e.x);
}
