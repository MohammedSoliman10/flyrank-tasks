/** Collapse HTML whitespace into a single-line value. */
export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a Books to Scrape price such as "£51.77" into 51.77.
 * Returns null when the string is not a valid GBP amount.
 */
export function parsePriceGbp(priceText) {
  const match = /£\s*([0-9][0-9,]*\.[0-9]{2})/.exec(String(priceText ?? ''));
  if (!match) return null;

  const amount = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : null;
}
