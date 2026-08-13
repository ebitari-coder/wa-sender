export function normalizeNumber(raw: string): string | null {
  let n = raw
    .toString()
    .trim()
    .replace(/[\s\-().]+/g, "")
    .replace(/^00/, "+")
    .replace(/^0/, "+234")
    .replace(/[^+\d]/g, "");

  if (!n) return null;
  if (!n.startsWith("+")) n = "+" + n;

  if (n === "+234" || n.length < 8 || n.length > 15) return null;
  if (!/^\+\d{7,14}$/.test(n)) return null;

  // Standardize Nigerian numbers: strip +234 prefix into local "0" form is NOT
  // what WhatsApp needs — WhatsApp wants the country code, so keep +<cc><number>.
  return n;
}

export function extractNumbers(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = input
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const c of candidates) {
    const norm = normalizeNumber(c);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
