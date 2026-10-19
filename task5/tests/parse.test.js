import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { parseBookPage } from '../src/book.js';
import { parseCatalogue } from '../src/catalogue.js';
import { bookSchema, validateBook } from '../src/schema.js';
import { parsePriceGbp } from '../src/text.js';

const catalogueHtml = await readFile(new URL('../fixtures/catalogue.html', import.meta.url), 'utf8');
const bookHtml = await readFile(new URL('../fixtures/book.html', import.meta.url), 'utf8');
const noDescriptionHtml = await readFile(
  new URL('../fixtures/book-no-description.html', import.meta.url),
  'utf8',
);

const catalogueUrl = 'https://books.toscrape.com/catalogue/page-1.html';
const bookUrl = 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html';
const fetchedAt = '2026-10-19T12:00:00.000Z';

test('catalogue parser resolves relative product URLs and next link', () => {
  const result = parseCatalogue(catalogueHtml, catalogueUrl);

  assert.equal(result.books.length, 2);
  assert.equal(result.books[0].title, 'A Light in the Attic');
  assert.equal(result.books[0].product_url, bookUrl);
  assert.equal(
    result.books[1].product_url,
    'https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html',
  );
  assert.equal(result.next_url, 'https://books.toscrape.com/catalogue/page-2.html');
});

test('price parser turns a GBP string into a number', () => {
  assert.equal(parsePriceGbp('£51.77'), 51.77);
  assert.equal(parsePriceGbp('£1,234.50'), 1234.5);
  assert.equal(parsePriceGbp('not a price'), null);
});

test('book parser extracts all raw fields and the numeric price', () => {
  const book = parseBookPage(bookHtml, {
    url: bookUrl,
    sourcePage: catalogueUrl,
    fetchedAt,
  });

  assert.equal(book.title, 'A Light in the Attic');
  assert.equal(book.product_url, bookUrl);
  assert.equal(book.price_text, '£51.77');
  assert.equal(book.price_gbp, 51.77);
  assert.equal(book.availability_text, 'In stock (22 available)');
  assert.equal(book.rating_text, 'Three');
  assert.match(book.description, /Shel Silverstein/);
  assert.equal(book.source_page, catalogueUrl);
  assert.equal(book.fetched_at, fetchedAt);

  const checked = validateBook(book);
  assert.equal(checked.ok, true);
});

test('missing description is stored as null rather than an invented string', () => {
  const book = parseBookPage(noDescriptionHtml, {
    url: 'https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html',
    sourcePage: catalogueUrl,
    fetchedAt,
  });

  assert.equal(book.description, null);
  assert.equal(book.rating_text, 'One');
  assert.equal(validateBook(book).ok, true);
});

test('schema rejects a non-numeric price and missing required fields', () => {
  const badPrice = {
    title: 'Bad price',
    product_url: bookUrl,
    price_text: 'free',
    availability_text: 'In stock',
    rating_text: 'Three',
    description: null,
    source_page: catalogueUrl,
    fetched_at: fetchedAt,
    price_gbp: null,
  };

  const result = bookSchema.safeParse(badPrice);
  assert.equal(result.success, false);

  const missingTitle = { ...badPrice, title: '', price_gbp: 0 };
  const checked = validateBook(missingTitle);
  assert.equal(checked.ok, false);
  assert.match(checked.reason, /title/i);
});

test('schema rejects unknown fields so the published contract stays stable', () => {
  const book = parseBookPage(bookHtml, {
    url: bookUrl,
    sourcePage: catalogueUrl,
    fetchedAt,
  });

  const result = bookSchema.safeParse({ ...book, unexpected: 'value' });
  assert.equal(result.success, false);
});
