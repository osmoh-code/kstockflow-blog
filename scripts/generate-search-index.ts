#!/usr/bin/env tsx
/**
 * Generates a search index JSON file from all blog posts.
 * Runs as a prebuild step so client-side search can work on static export.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const OUTPUT_PATH = path.join(process.cwd(), "public", "search-index.json");

interface SearchEntry {
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly category: string;
  readonly slug: string;
  readonly thumbnail: string;
  readonly tags: readonly string[];
  readonly readingTime: string;
}

function main(): void {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.writeFileSync(OUTPUT_PATH, "[]", "utf-8");
    console.log("No posts found, wrote empty search index.");
    return;
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));

  const entries: SearchEntry[] = files
    .map((file) => {
      const filePath = path.join(POSTS_DIR, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);
      const stats = readingTime(content);

      return {
        title: data.title ?? "",
        description: data.description ?? "",
        date: data.date ?? "",
        category: data.category ?? "",
        slug: file.replace(/\.mdx?$/, ""),
        thumbnail: data.thumbnail ?? "/images/og-default.png",
        tags: data.tags ?? [],
        readingTime: stats.text,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(entries), "utf-8");
  console.log(`Search index generated: ${entries.length} posts → ${OUTPUT_PATH}`);
}

main();
