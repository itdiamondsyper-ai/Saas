import { z } from "zod";

export const uuid = z.uuid("Invalid identifier");

/** Optional free text: trims, caps length and stores empty input as null. */
export const optionalText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(max, `Must be ${max} characters or fewer`))
    .transform((v) => (v === "" ? null : v));

export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);

export const optionalUuid = z
  .union([z.uuid(), z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const optionalDate = z
  .union([dateString, z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

export const money = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .min(0, `${label} can't be negative`)
    .max(100_000_000, `${label} is too large`)
    .transform((v) => Math.round(v * 100) / 100);

export const tagList = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(",")))
  .transform((tags) =>
    Array.from(new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 12),
  )
  .pipe(z.array(z.string().max(30, "Tags must be 30 characters or fewer")));

export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const optionalEmail = z
  .union([z.string(), z.null()])
  .transform((v) => (v ?? "").trim().toLowerCase())
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email("Enter a valid email address").nullable());

export const optionalUrl = z
  .union([z.string(), z.null()])
  .transform((v) => (v ?? "").trim())
  .transform((v) => (v === "" ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.url({ protocol: /^https?$/, error: "Enter a valid website address" }).nullable());
