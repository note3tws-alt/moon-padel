// ISO 3166-1 alpha-2 codes for the countries most common in UAE padel, plus a lookup
// that accepts codes or English names in imports.
export const COUNTRIES: Record<string, string> = {
  AE: "United Arab Emirates", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", BH: "Bahrain", OM: "Oman",
  EG: "Egypt", JO: "Jordan", LB: "Lebanon", SY: "Syria", IQ: "Iraq", PS: "Palestine", MA: "Morocco", TN: "Tunisia", DZ: "Algeria",
  ES: "Spain", AR: "Argentina", IT: "Italy", FR: "France", PT: "Portugal", GB: "United Kingdom", IE: "Ireland", NL: "Netherlands",
  BE: "Belgium", DE: "Germany", SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", CH: "Switzerland", AT: "Austria",
  PL: "Poland", RU: "Russia", UA: "Ukraine", TR: "Turkey", GR: "Greece", RO: "Romania", CZ: "Czechia",
  US: "United States", CA: "Canada", MX: "Mexico", BR: "Brazil", CL: "Chile", UY: "Uruguay", CO: "Colombia", VE: "Venezuela",
  IN: "India", PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka", PH: "Philippines", CN: "China", JP: "Japan", KR: "South Korea",
  SG: "Singapore", MY: "Malaysia", ID: "Indonesia", AU: "Australia", NZ: "New Zealand", ZA: "South Africa", NG: "Nigeria",
  KE: "Kenya", IR: "Iran", KZ: "Kazakhstan",
};

const byName = new Map(Object.entries(COUNTRIES).map(([code, name]) => [name.toLowerCase(), code]));
const aliases: Record<string, string> = { uae: "AE", "u.a.e.": "AE", emirates: "AE", uk: "GB", england: "GB", scotland: "GB", wales: "GB", usa: "US", "u.s.": "US", america: "US", ksa: "SA", korea: "KR", holland: "NL" };

export function toCountryCode(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  const l = v.toLowerCase();
  return byName.get(l) ?? aliases[l] ?? null;
}

export function countryName(code?: string | null): string {
  if (!code) return "";
  return COUNTRIES[code.toUpperCase()] ?? code.toUpperCase();
}
