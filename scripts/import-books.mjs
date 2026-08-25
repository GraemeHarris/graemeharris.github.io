#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import GithubSlugger from "github-slugger";
import matter from "gray-matter";
import Vibrant from "node-vibrant";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const CONTENT_DIR = resolve(REPO_ROOT, "src/content/books");
const COVERS_DIR = resolve(REPO_ROOT, "public/assets/books");
const PLACEHOLDER_PATH = "/assets/books/_placeholder.svg";
const FALLBACK_SPINE = "#5b4636";

const IMPORTER_OWNED_KEYS = [
  "title",
  "author",
  "isbn",
  "rating",
  "dateRead",
  "dateAdded",
  "shelves",
  "pages",
  "goodreadsId",
  "cover",
  "spineColor",
];

function unwrapGoodreadsField(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const m = trimmed.match(/^="(.*)"$/);
  return (m ? m[1] : trimmed).trim();
}

function pickIsbn(row) {
  const i13 = unwrapGoodreadsField(row["ISBN13"]);
  if (i13) return i13.replace(/[^0-9Xx]/g, "");
  const i10 = unwrapGoodreadsField(row["ISBN"]);
  if (i10) return i10.replace(/[^0-9Xx]/g, "");
  return null;
}

function parseShelves(row) {
  const raw = (row["Bookshelves"] || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function parseDate(value) {
  if (!value) return null;
  const m = String(value)
    .trim()
    .match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

async function fetchCover(isbn, destPath) {
  if (!isbn) return { ok: false, reason: "no-isbn" };
  if (existsSync(destPath)) return { ok: true, cached: true };
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 256) return { ok: false, reason: "empty" };
    writeFileSync(destPath, buf);
    return { ok: true, cached: false };
  } catch (err) {
    return { ok: false, reason: `fetch-error:${err.message}` };
  }
}

async function extractSpineColor(coverPath) {
  try {
    const palette = await Vibrant.from(coverPath).getPalette();
    return (
      palette.Vibrant?.hex ||
      palette.DarkVibrant?.hex ||
      palette.Muted?.hex ||
      palette.DarkMuted?.hex ||
      FALLBACK_SPINE
    );
  } catch {
    return FALLBACK_SPINE;
  }
}

function buildSlug(slugger, title, goodreadsId) {
  const base = slugger.slug(title || "untitled");
  const hash = createHash("sha1")
    .update(String(goodreadsId))
    .digest("hex")
    .slice(0, 6);
  return `${base}-${hash}`;
}

function serialize(data, body) {
  return matter.stringify(body ?? "", data, {
    sortKeys: false,
  });
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      "Usage: yarn books:import <path-to-goodreads_export.csv>"
    );
    process.exit(1);
  }
  const absCsv = resolve(process.cwd(), csvPath);
  if (!existsSync(absCsv)) {
    console.error(`CSV not found at ${absCsv}`);
    process.exit(1);
  }

  mkdirSync(CONTENT_DIR, { recursive: true });
  mkdirSync(COVERS_DIR, { recursive: true });

  const csvRaw = readFileSync(absCsv, "utf8");
  const rows = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const slugger = new GithubSlugger();
  let imported = 0;
  let updated = 0;
  let coversFetched = 0;
  let coversMissing = 0;

  const readRows = rows.filter(
    r => unwrapGoodreadsField(r["Exclusive Shelf"]) === "read"
  );

  for (const row of readRows) {
    slugger.reset();
    const title = unwrapGoodreadsField(row["Title"]);
    const author = unwrapGoodreadsField(row["Author"]);
    const goodreadsId = unwrapGoodreadsField(row["Book Id"]);
    if (!title || !goodreadsId) {
      console.warn("Skipping row missing title/Book Id");
      continue;
    }

    const slug = buildSlug(slugger, title, goodreadsId);
    const mdxPath = resolve(CONTENT_DIR, `${slug}.mdx`);
    const coverPath = resolve(COVERS_DIR, `${slug}.jpg`);
    const isbn = pickIsbn(row);

    const fetchResult = await fetchCover(isbn, coverPath);
    if (fetchResult.ok && !fetchResult.cached) coversFetched++;
    if (!fetchResult.ok && !existsSync(coverPath)) {
      coversMissing++;
      console.warn(
        `  no cover for "${title}" (${fetchResult.reason ?? "unknown"})`
      );
    }

    const haveLocalCover = existsSync(coverPath);
    const cover = haveLocalCover
      ? `/assets/books/${slug}.jpg`
      : PLACEHOLDER_PATH;
    const spineColor = haveLocalCover
      ? await extractSpineColor(coverPath)
      : FALLBACK_SPINE;

    const ratingRaw = parseInt(row["My Rating"] ?? "0", 10);
    const rating = Number.isFinite(ratingRaw)
      ? Math.max(0, Math.min(5, ratingRaw))
      : 0;
    const pagesRaw = parseInt(row["Number of Pages"] ?? "", 10);
    const pages = Number.isFinite(pagesRaw) ? pagesRaw : undefined;

    const importerData = {
      title,
      author,
      isbn: isbn || undefined,
      rating,
      dateRead: parseDate(unwrapGoodreadsField(row["Date Read"])),
      dateAdded: parseDate(unwrapGoodreadsField(row["Date Added"])),
      shelves: parseShelves(row),
      pages,
      goodreadsId,
      cover,
      spineColor,
    };

    if (existsSync(mdxPath)) {
      const existing = matter(readFileSync(mdxPath, "utf8"));
      const merged = { ...existing.data };
      for (const key of IMPORTER_OWNED_KEYS) {
        if (importerData[key] === undefined) {
          delete merged[key];
        } else {
          merged[key] = importerData[key];
        }
      }
      if (typeof merged.favourite !== "boolean") merged.favourite = false;
      writeFileSync(mdxPath, serialize(merged, existing.content));
      updated++;
    } else {
      const data = { ...importerData, favourite: false };
      for (const k of Object.keys(data)) {
        if (data[k] === undefined) delete data[k];
      }
      writeFileSync(mdxPath, serialize(data, ""));
      imported++;
    }
  }

  console.log(
    `\nDone. ${imported} imported, ${updated} updated, ${coversFetched} covers fetched, ${coversMissing} covers missing.`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
