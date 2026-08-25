import { SITE } from "@config";
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image()
        .refine(img => img.width >= 1200 && img.height >= 630, {
          message: "OpenGraph image must be at least 1200 X 630 pixels!",
        })
        .or(z.string())
        .optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
    }),
});

const books = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/books" }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    isbn: z.string().optional(),
    rating: z.number().int().min(0).max(5).optional(),
    dateRead: z.coerce.date().optional().nullable(),
    dateAdded: z.coerce.date().optional(),
    shelves: z.array(z.string()).default([]),
    pages: z.number().int().optional(),
    cover: z.string(),
    favourite: z.boolean().default(false),
    oneLineTake: z.string().optional(),
    // Which curated row a book sits in on /books, and where in that row.
    // Anything without a list falls through to the plain "Also read" list.
    list: z.enum(["best", "thoughts"]).optional(),
    order: z.number().int().optional(),
    // Written by scripts/import-books.mjs; hand-written entries omit them.
    goodreadsId: z.string().optional(),
    spineColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
});

export const collections = { blog, books };
