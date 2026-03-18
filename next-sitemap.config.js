/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: "https://kstockflow.com",
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: "daily",
  priority: 0.7,
  exclude: ["/api/*", "/admin/*", "/feed.xml"],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    additionalSitemaps: [
      "https://kstockflow.com/sitemap.xml",
    ],
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
