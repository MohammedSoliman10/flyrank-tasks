import * as cheerio from 'cheerio';

import { cleanText } from './text.js';

/**
 * Extract product links and the "next" link from one catalogue page.
 *
 * URLs in the page are relative ("a-light-in-the-attic_1000/index.html"), so
 * they are resolved against the catalogue page URL.
 */
export function parseCatalogue(html, pageUrl) {
  const $ = cheerio.load(html);
  const books = [];
  const seen = new Set();

  $('article.product_pod h3 a').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    const productUrl = new URL(href, pageUrl).href;
    if (seen.has(productUrl)) return;

    const title = cleanText($(element).attr('title') || $(element).text());
    seen.add(productUrl);
    books.push({ title, product_url: productUrl });
  });

  if (books.length === 0) {
    throw new Error(`No products found on catalogue page ${pageUrl}`);
  }

  const nextHref = $('li.next a').first().attr('href');
  return {
    books,
    next_url: nextHref ? new URL(nextHref, pageUrl).href : null,
  };
}
