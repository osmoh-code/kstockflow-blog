import fs from "node:fs";
import matter from "gray-matter";
import { postMdxPath } from "./shorts-paths";

export interface LoadedPost {
  readonly slug: string;
  readonly data: Record<string, unknown>;
  readonly content: string;
}

/**
 * Load a blog post by slug and parse its frontmatter + body.
 *
 * Note: We return the raw `data` object from gray-matter rather than the
 * project's `PostMeta` type, because PostMeta omits the `relatedStocks` field
 * which we need for shorts script generation.
 */
export function loadPost(slug: string): LoadedPost {
  const filePath = postMdxPath(slug);

  if (!fs.existsSync(filePath)) {
    throw new Error(`포스트 파일 없음: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);

  return {
    slug,
    data: parsed.data,
    content: parsed.content,
  };
}

export function getRelatedStocks(post: LoadedPost): readonly string[] {
  const value = post.data.relatedStocks;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === "string");
}

export function getTags(post: LoadedPost): readonly string[] {
  const value = post.data.tags;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === "string");
}
