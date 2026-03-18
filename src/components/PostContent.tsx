import { remark } from "remark";
import html from "remark-html";
import {
  generateArticleStructuredData,
} from "@/lib/seo";
import type { PostMeta } from "@/lib/posts";
import AdPlacement from "./AdPlacement";

interface PostContentProps {
  readonly content: string;
  readonly meta: PostMeta;
}

interface TocItem {
  readonly id: string;
  readonly text: string;
}

function extractHeadings(htmlContent: string): readonly TocItem[] {
  const regex = /<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/g;
  const headings: TocItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(htmlContent)) !== null) {
    headings.push({
      id: match[1],
      text: match[2].replace(/<[^>]*>/g, ""),
    });
  }

  return headings;
}

function addIdsToHeadings(htmlContent: string): string {
  let counter = 0;
  return htmlContent.replace(/<h2([^>]*)>(.*?)<\/h2>/g, (_match, attrs, text) => {
    const plainText = text.replace(/<[^>]*>/g, "");
    const id = `heading-${counter++}-${plainText
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50)}`;
    return `<h2${attrs} id="${id}">${text}</h2>`;
  });
}

function insertAdsAfterHeadings(htmlContent: string): string {
  let headingCount = 0;
  return htmlContent.replace(/<\/h2>/g, (match) => {
    headingCount++;
    if (headingCount % 3 === 0) {
      return `${match}<div class="ad-in-article" data-ad-slot="in-article"></div>`;
    }
    return match;
  });
}

export default async function PostContent({ content, meta }: PostContentProps) {
  const processed = await remark().use(html).process(content);
  let htmlContent = processed.toString();

  htmlContent = addIdsToHeadings(htmlContent);
  const headings = extractHeadings(htmlContent);
  htmlContent = insertAdsAfterHeadings(htmlContent);

  const structuredData = generateArticleStructuredData(meta);

  return (
    <div>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />

      {/* Table of Contents */}
      {headings.length > 2 && (
        <nav
          className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5"
          aria-label="목차"
        >
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-900">
            목차
          </h2>
          <ol className="space-y-1.5">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  className="text-sm text-gray-500 transition-colors duration-150 hover:text-brand-accent"
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Article Content */}
      <div
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* Bottom Ad */}
      <AdPlacement type="post-bottom" />
    </div>
  );
}
