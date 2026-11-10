import { z } from 'zod';

/** Accepts 0803 123 4567, +234 803 123 4567 and similar; stores digits with an optional +. */
const phone = z
  .string()
  .trim()
  .min(1, 'Enter a phone number we can call you on.')
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine(
    (value) => /^\+?\d{10,14}$/.test(value),
    'Enter a valid phone number, for example 0803 123 4567.'
  );

export const requestSchema = z.object({
  contactName: z.string().trim().min(2, 'Enter your name.').max(80, 'That name is too long.'),
  contactPhone: phone,
  hospitalId: z.string(),
  notes: z.string().trim().max(500, 'Keep this under 500 characters.').optional(),
});

export const NEAREST = 'nearest';
