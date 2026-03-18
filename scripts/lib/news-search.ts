/**
 * Google News RSS를 이용한 키워드 뉴스 검색
 * - 글 생성 시 최신 뉴스 컨텍스트를 Claude에게 전달
 */

import https from "https";

export interface NewsItem {
  readonly title: string;
  readonly source: string;
  readonly pubDate: string;
}

/**
 * Google News RSS에서 키워드 관련 최신 뉴스 검색
 * @param keyword 검색 키워드
 * @param maxItems 최대 가져올 뉴스 수 (기본 10)
 */
export function searchNews(keyword: string, maxItems = 10): Promise<readonly NewsItem[]> {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(keyword);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=ko&gl=KR&ceid=KR:ko`;

    const req = https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 10000,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try {
          const xml = Buffer.concat(chunks).toString("utf-8");
          const items: NewsItem[] = [];

          // <item> 블록 추출
          const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

          for (const block of itemBlocks.slice(0, maxItems)) {
            const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
            const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);

            if (titleMatch) {
              const rawTitle = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
              // " - 출처" 형태에서 출처 분리
              const dashIdx = rawTitle.lastIndexOf(" - ");
              const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx).trim() : rawTitle;
              const source = sourceMatch?.[1]?.trim()
                ?? (dashIdx > 0 ? rawTitle.slice(dashIdx + 3).trim() : "");

              const pubDate = pubDateMatch?.[1]?.trim() ?? "";

              items.push({ title, source, pubDate });
            }
          }

          console.log(`  📰 뉴스 검색 완료: "${keyword}" → ${items.length}건`);
          resolve(items);
        } catch (error) {
          console.warn("  ⚠️ 뉴스 파싱 실패:", error);
          resolve([]);
        }
      });
    });

    req.on("error", (error) => {
      console.warn("  ⚠️ 뉴스 검색 실패:", error.message);
      resolve([]);
    });

    req.on("timeout", () => {
      req.destroy();
      console.warn("  ⚠️ 뉴스 검색 타임아웃");
      resolve([]);
    });
  });
}

/**
 * 뉴스 목록을 Claude 프롬프트에 삽입할 컨텍스트 문자열로 변환
 */
export function newsToContext(news: readonly NewsItem[]): string {
  if (news.length === 0) return "";

  let context = "\n[최신 뉴스 — 반드시 이 뉴스들을 참고하여 글을 작성하세요]\n";

  for (const item of news) {
    const dateStr = item.pubDate
      ? new Date(item.pubDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
      : "";
    context += `- ${item.title}`;
    if (item.source) context += ` (${item.source})`;
    if (dateStr) context += ` [${dateStr}]`;
    context += "\n";
  }

  context += "\n위 뉴스에서 언급된 구체적 사건, 수치, 기업명, 계약 내용을 본문에 반드시 반영하세요.\n";

  return context;
}
