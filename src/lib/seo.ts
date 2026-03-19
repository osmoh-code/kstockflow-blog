import { SITE_NAME, SITE_URL, AUTHOR_NAME } from "./constants";
import type { PostMeta } from "./posts";

export interface BreadcrumbItem {
  readonly name: string;
  readonly url: string;
}

export interface FAQItem {
  readonly question: string;
  readonly answer: string;
}

export function generateArticleStructuredData(post: PostMeta): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
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
    articleSection: post.category,
    inLanguage: "ko",
    wordCount: 5000,
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

export function generateFAQStructuredData(faqs: readonly FAQItem[]): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return JSON.stringify(structuredData);
}

export function generateOrganizationStructuredData(): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/images/logo.png`,
    },
    description:
      "한국 주식 시장의 특징주, 핫이슈, 신규 상장주, 재료와 테마 뉴스를 한눈에. 재료 기반의 깊이 있는 시장 인사이트를 제공합니다.",
    sameAs: [],
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
    inLanguage: "ko",
  };

  return JSON.stringify(structuredData);
}

/**
 * Extract FAQ items from post content.
 * Looks for ## 자주 묻는 질문 section with ### Q. headings.
 */
export function extractFAQFromContent(content: string): readonly FAQItem[] {
  const faqSection = content.match(/## 자주 묻는 질문[\s\S]*?(?=## |$)/);
  if (!faqSection) return [];

  const faqs: FAQItem[] = [];
  const qaPairs = faqSection[0].matchAll(
    /###\s*Q\.\s*(.+?)\n+([\s\S]*?)(?=###\s*Q\.|$)/g
  );

  for (const match of qaPairs) {
    const question = match[1].trim();
    const answer = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/\*\*/g, "")
      .replace(/\n+/g, " ")
      .trim();
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}
