/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: "https://kstockflow.com",
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: "daily",
  priority: 0.7,
  exclude: ["/api/*", "/admin/*", "/feed.xml"],
  
  // 구글 봇이 헤매지 않도록 단일 사이트맵으로 묶어주는 필수 옵션
  generateIndexSitemap: false, 

  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    // 문제를 일으켰던 additionalSitemaps는 삭제했습니다.
  },
  transform: async (config, path) => {
    // Blog post pages get higher priority and daily updates
    if (path.startsWith("/posts/")) {
      return {
        loc: path,
        changefreq: "weekly",
        priority: 0.8,
        lastmod: new Date().toISOString(),
      };
    }

    // Home page gets highest priority
    if (path === "/") {
      return {
        loc: path,
        changefreq: "daily",
        priority: 1.0,
        lastmod: new Date().toISOString(),
      };
    }

    // Category pages
    if (path.startsWith("/category/")) {
      return {
        loc: path,
        changefreq: "daily",
        priority: 0.7,
        lastmod: new Date().toISOString(),
      };
    }

    // Default for other pages
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};

module.exports = config;
