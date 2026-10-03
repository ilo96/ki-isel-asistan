/**
 * Türkçe ve İngilizce yazılmış ondalık sayıyı okur: "80,5", "80.5", " 72 ". Binlik ayırıcı
 * vücut ölçülerinde kullanılmadığı için tek ayırıcı ondalık sayılır; "1.234,5" gibi ikisi
 * birden varsa nokta binliktir. Rakam, nokta ve virgül dışında karakter varsa null döner.
 */
export function parseLocaleNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s || !/^\d*[.,]?\d*$|^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return null;
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(",", ".");
  if (normalized === "." || normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
