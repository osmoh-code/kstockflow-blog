const fs = require("fs");
const path = require("path");

/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: "https://kstockflow.com",
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: "daily",
  priority: 0.7,
  exclude: ["/api/*", "/admin/*", "/feed.xml", "/icon.svg"],
  
  // 구글 봇이 헤매지 않도록 단일 사이트맵으로 묶어주는 필수 옵션
  generateIndexSitemap: false, 

  outDir: "out",

  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
      // AI Search Crawlers (GEO — allow citation in AI answers)
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "Amazonbot", allow: "/" },
    ],
  },
  transform: async (config, urlPath) => {
    // MDX 파일의 실제 수정일을 lastmod로 사용 (Google이 동일 lastmod를 무시하므로)
    function getPostLastmod(urlPath) {
      const slug = urlPath.replace(/^\/posts\//, "").replace(/\/$/, "");
      const mdxPath = path.join(process.cwd(), "content", "posts", `${slug}.mdx`);
      try {
        const stat = fs.statSync(mdxPath);
        return stat.mtime.toISOString();
      } catch {
        return new Date().toISOString();
      }
    }

    // Blog post pages: boost crawl signal on the 7 newest posts.
    // Newest 7 by mtime → changefreq=daily, priority=1.0
    // Rest → changefreq=daily (news-style site), priority=0.8
    function isTopNRecentPost(urlPath, n = 7) {
      try {
        const postsDir = path.join(process.cwd(), "content", "posts");
        const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".mdx"));
        const sorted = files
          .map((f) => ({ f, mtime: fs.statSync(path.join(postsDir, f)).mtime.getTime() }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, n)
          .map((x) => x.f.replace(/\.mdx$/, ""));
        const slug = urlPath.replace(/^\/posts\//, "").replace(/\/$/, "");
        return sorted.includes(slug);
      } catch {
        return false;
      }
    }

    if (urlPath.startsWith("/posts/")) {
      const isHot = isTopNRecentPost(urlPath, 7);
      return {
        loc: urlPath,
        changefreq: "daily",
        priority: isHot ? 1.0 : 0.8,
        lastmod: getPostLastmod(urlPath),
      };
    }

    // Home page gets highest priority
    if (urlPath === "/") {
      return {
        loc: urlPath,
        changefreq: "daily",
        priority: 1.0,
        lastmod: new Date().toISOString(),
      };
    }

    // Category pages
    if (urlPath.startsWith("/category/")) {
      return {
        loc: urlPath,
        changefreq: "daily",
        priority: 0.6,
        lastmod: new Date().toISOString(),
      };
    }

    // 유틸리티 페이지 (contact, privacy, disclaimer, about) — 낮은 우선순위
    return {
      loc: urlPath,
      changefreq: "monthly",
      priority: 0.3,
      lastmod: new Date().toISOString(),
    };
  },
};

module.exports = config;
