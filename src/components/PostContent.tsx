import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import {
  generateArticleStructuredData,
} from "@/lib/seo";
import { getPostsByCategory, type PostMeta } from "@/lib/posts";
import AdPlacement from "./AdPlacement";
import BlogCard from "./BlogCard";

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
  const processed = await remark()
    .use(remarkGfm, { singleTilde: false })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(content);
  let htmlContent = processed.toString();

  htmlContent = addIdsToHeadings(htmlContent);
  const headings = extractHeadings(htmlContent);
  htmlContent = insertAdsAfterHeadings(htmlContent);

  // "함께 보면 좋은 분석 글" 텍스트 섹션 제거 (컴포넌트로 대체)
  htmlContent = htmlContent.replace(
    /<h3[^>]*>함께 보면 좋은 분석 글<\/h3>\s*<ul>[\s\S]*?<\/ul>/,
    ""
  );

  const structuredData = generateArticleStructuredData(meta);

  // 본문을 "자주 묻는 질문" H2 기준으로 분할 → 그 사이에 추천글 카드 삽입
  const faqSplitRegex = /(<h2[^>]*id="[^"]*"[^>]*>.*?자주 묻는 질문.*?<\/h2>)/;
  const parts = htmlContent.split(faqSplitRegex);
  const beforeFaq = parts[0] ?? htmlContent;
  const faqHeading = parts[1] ?? "";
  const afterFaqHeading = parts.slice(2).join("");

  // 핫이슈 중 slug 기반 랜덤 3개 (글마다 다른 추천)
  const hotIssues = getPostsByCategory("hot-issues")
    .filter((p) => p.meta.slug !== meta.slug);
  let rSeed = 0;
  for (let i = 0; i < meta.slug.length; i++) {
    rSeed = Math.imul(rSeed ^ meta.slug.charCodeAt(i), 2654435761);
  }
  rSeed = rSeed >>> 0;
  const rCopy = [...hotIssues];
  // Mulberry32 PRNG + Fisher-Yates shuffle
  let rState = rSeed;
  for (let i = rCopy.length - 1; i > 0; i--) {
    rState = (rState + 0x6d2b79f5) | 0;
    let t = Math.imul(rState ^ (rState >>> 15), 1 | rState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [rCopy[i], rCopy[j]] = [rCopy[j], rCopy[i]];
  }
  const recommendedPosts = rCopy.slice(0, 3);

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

      {/* Article Content — FAQ 앞 */}
      <div
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: beforeFaq }}
      />

      {/* 함께 보면 좋은 분석 글 — 본문 내 FAQ 바로 위 */}
      {recommendedPosts.length > 0 && (
        <section className="my-10 rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <h2 className="mb-5 text-lg font-bold text-gray-900">
            함께 보면 좋은 분석 글
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {recommendedPosts.map((post) => (
              <BlogCard key={post.meta.slug} post={post.meta} />
            ))}
          </div>
        </section>
      )}

      {/* Article Content — FAQ 이후 */}
      {faqHeading && (
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: faqHeading + afterFaqHeading }}
        />
      )}

      {/* Bottom Ad */}
      <AdPlacement type="post-bottom" />
    </div>
  );
}
