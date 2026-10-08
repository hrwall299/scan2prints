// Shared, pure pricing logic used by the customer UI and the server.
export type PricingSettings = {
  bw_price: number;
  color_price: number;
  a3_multiplier: number;
  glossy_surcharge: number;
  duplex_discount: number;
  currency: string;
};

export type PrintOptions = {
  pages: number;
  copies: number;
  color_mode: "bw" | "color";
  page_size: string;
  paper_type: string;
  sides: string;
};

export const PAGE_SIZES = ["A4", "A3", "Letter", "Legal"] as const;
export const PAPER_TYPES = [
  { value: "standard", label: "Standard 70 GSM" },
  { value: "premium", label: "Premium 100 GSM" },
  { value: "glossy", label: "Glossy photo paper" },
] as const;
export const SIDES = [
  { value: "single", label: "Single-sided" },
  { value: "double", label: "Double-sided" },
] as const;

export function perPagePrice(s: PricingSettings, o: Pick<PrintOptions, "color_mode" | "page_size" | "paper_type">) {
  const base = o.color_mode === "color" ? Number(s.color_price) : Number(s.bw_price);
  const mult = o.page_size === "A3" ? Number(s.a3_multiplier) : 1;
  const surcharge = o.paper_type === "glossy" ? Number(s.glossy_surcharge) : 0;
  return base * mult + surcharge;
}

/** If color_pages is given, those pages are charged at colour price and the rest at B&W. */
export function calcPrice(s: PricingSettings, o: PrintOptions & { color_pages?: number | undefined }) {
  const pages = Math.max(0, Math.floor(o.pages));
  const copies = Math.max(1, Math.floor(o.copies));
  let perCopy: number;
  if (o.color_pages === undefined) perCopy = perPagePrice(s, o) * pages;
  else {
    const c = Math.min(pages, Math.max(0, Math.floor(o.color_pages)));
    perCopy = perPagePrice(s, { ...o, color_mode: "color" }) * c + perPagePrice(s, { ...o, color_mode: "bw" }) * (pages - c);
  }
  let total = perCopy * copies;
  if (o.sides === "double") total *= 1 - Number(s.duplex_discount) / 100;
  return Math.round(total * 100) / 100;
}

export function money(s: Pick<PricingSettings, "currency">, n: number) {
  return `${s.currency}${Number(n).toFixed(2)}`;
}
