import { z } from 'zod';

export const RATINGS = ['One', 'Two', 'Three', 'Four', 'Five'];

/**
 * The published contract for output/books.json.
 *
 * The first eight fields are the raw extraction. price_gbp is the cleaned,
 * numeric value derived from price_text.
 */
export const bookSchema = z
  .object({
    title: z.string().min(1),
    product_url: z.string().url(),
    price_text: z.string().min(1),
    availability_text: z.string().min(1),
    rating_text: z.enum(RATINGS),
    description: z.string().nullable(),
    source_page: z.string().url(),
    fetched_at: z.string().datetime(),
    price_gbp: z.number().nonnegative(),
  })
  .strict();

export function validateBook(record) {
  const result = bookSchema.safeParse(record);
  if (result.success) return { ok: true, data: result.data };

  const reason = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return { ok: false, reason };
}
