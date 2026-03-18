import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";

const POSTS_DIRECTORY = path.join(process.cwd(), "content", "posts");

export interface PostMeta {
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly category: string;
  readonly slug: string;
  readonly thumbnail: string;
  readonly tags: readonly string[];
  readonly readingTime: string;
}

export interface Post {
  readonly meta: PostMeta;
  readonly content: string;
}

function getPostFiles(): readonly string[] {
  if (!fs.existsSync(POSTS_DIRECTORY)) {
    return [];
  }
  return fs
    .readdirSync(POSTS_DIRECTORY)
    .filter((file) => file.endsWith(".mdx") || file.endsWith(".md"));
}

function parsePostFile(fileName: string): Post {
  const slug = fileName.replace(/\.mdx?$/, "");
  const filePath = path.join(POSTS_DIRECTORY, fileName);
  const fileContents = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContents);
  const stats = readingTime(content);

  const meta: PostMeta = {
    title: data.title ?? "",
    description: data.description ?? "",
    date: data.date ?? "",
    category: data.category ?? "",
    slug,
    thumbnail: data.thumbnail ?? "/images/og-default.png",
    tags: data.tags ?? [],
    readingTime: stats.text,
  };

  return { meta, content };
}

export function getAllPosts(): readonly Post[] {
  const files = getPostFiles();

  const posts = files.map((file) => parsePostFile(file));

  return [...posts].sort(
    (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
  );
}

export function getPostBySlug(slug: string): Post | null {
  const files = getPostFiles();
  const fileName = files.find(
    (file) => file.replace(/\.mdx?$/, "") === slug
  );

  if (!fileName) {
    return null;
  }

  return parsePostFile(fileName);
}

export function getPostsByCategory(category: string): readonly Post[] {
  const allPosts = getAllPosts();
  return allPosts.filter((post) => post.meta.category === category);
}

export function getAllCategories(): readonly string[] {
  const allPosts = getAllPosts();
  const categories = new Set(allPosts.map((post) => post.meta.category));
  return [...categories];
}

export function getAllTags(): readonly string[] {
  const allPosts = getAllPosts();
  const tags = new Set(allPosts.flatMap((post) => post.meta.tags));
  return [...tags];
}

export function getAllSlugs(): readonly string[] {
  const files = getPostFiles();
  return files.map((file) => file.replace(/\.mdx?$/, ""));
}
