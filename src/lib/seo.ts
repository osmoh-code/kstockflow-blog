import { SITE_NAME, SITE_URL, AUTHOR_NAME } from "./constants";
import type { PostMeta } from "./posts";

export interface BreadcrumbItem {
  readonly name: string;
  readonly url: string;
}

export function generateArticleStructuredData(post: PostMeta): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: post.thumbnail.startsWith("http")
      ? post.thumbnail
      : `${SITE_URL}${post.thumbnail}`,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Person",
      name: AUTHOR_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/posts/${post.slug}/`,
    },
    keywords: post.tags.join(", "),
  };

  return JSON.stringify(structuredData);
}

export function generateBreadcrumbStructuredData(
  items: readonly BreadcrumbItem[]
): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };

  return JSON.stringify(structuredData);
}

export function generateWebSiteStructuredData(): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "한국 주식 시장 분석, 특징주, 투자 전략, 경제 뉴스를 한눈에.",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/logo.png`,
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return JSON.stringify(structuredData);
}
