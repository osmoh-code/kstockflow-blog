export const dynamic = "force-static";

import { Feed } from "feed";
import { getAllPosts } from "@/lib/posts";
import {
  SITE_NAME,
  SITE_URL,
  SITE_DESCRIPTION,
  AUTHOR_NAME,
} from "@/lib/constants";

export async function GET() {
  const posts = getAllPosts();

  const feed = new Feed({
    title: `${SITE_NAME} - 한국 주식 시장 분석`,
    description: SITE_DESCRIPTION,
    id: SITE_URL,
    link: SITE_URL,
    language: "ko",
    image: `${SITE_URL}/images/og-default.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}, ${SITE_NAME}`,
    updated: posts.length > 0 ? new Date(posts[0].meta.date) : new Date(),
    feedLinks: {
      rss2: `${SITE_URL}/feed.xml`,
    },
    author: {
      name: AUTHOR_NAME,
      link: SITE_URL,
    },
  });

  for (const post of posts) {
    const postUrl = `${SITE_URL}/posts/${post.meta.slug}/`;

    feed.addItem({
      title: post.meta.title,
      id: postUrl,
      link: postUrl,
      description: post.meta.description,
      date: new Date(post.meta.date),
      category: post.meta.tags.map((tag) => ({ name: tag })),
      author: [
        {
          name: AUTHOR_NAME,
          link: SITE_URL,
        },
      ],
      image: post.meta.thumbnail.startsWith("http")
        ? post.meta.thumbnail
        : `${SITE_URL}${post.meta.thumbnail}`,
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
