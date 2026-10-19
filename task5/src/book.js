import * as cheerio from 'cheerio';

import { RATINGS } from './schema.js';
import { cleanText, parsePriceGbp } from './text.js';

function extractRating($) {
  const classes = ($('p.star-rating').first().attr('class') || '').split(/\s+/);
  return classes.find((name) => RATINGS.includes(name)) || '';
}

/**
 * Extract the eight raw fields from a product detail page.
 *
 * `description` is null when the page has no description block rather than
 * inventing an empty string.
 */
export function parseBookPage(html, { url, sourcePage, fetchedAt }) {
  const $ = cheerio.load(html);

  const title = cleanText($('div.product_main h1').first().text());
  const priceText = cleanText($('p.price_color').first().text());
  const availabilityText = cleanText($('p.instock.availability').first().text());
  const ratingText = extractRating($);

  const descriptionNode = $('#product_description').nextAll('p').first();
  const description = descriptionNode.length ? cleanText(descriptionNode.text()) : '';

  return {
    title,
    product_url: url,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description: description || null,
    source_page: sourcePage,
    fetched_at: fetchedAt,
    price_gbp: parsePriceGbp(priceText),
  };
}
