import { google } from "googleapis";
import fs from "fs";
import path from "path";

const SITE = "https://kstockflow.com/";
const TARGETS = [
  "https://kstockflow.com/posts/2026-03-25-featured-stocks/",
  "https://kstockflow.com/posts/2026-03-31-featured-stocks/",
  "https://kstockflow.com/posts/2026-04-06-featured-stocks/",
  "https://kstockflow.com/posts/2026-04-29-featured-stocks/",
  "https://kstockflow.com/posts/2026-04-22-featured-stocks/",
];

const credPath = path.join(process.cwd(), "google-credentials.json");
const auth = new google.auth.GoogleAuth({
  keyFile: credPath,
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
});
const sc = google.searchconsole({ version: "v1", auth: auth as never });

(async () => {
  for (const url of TARGETS) {
    try {
      const r = await sc.urlInspection.index.inspect({
        requestBody: { inspectionUrl: url, siteUrl: SITE, languageCode: "ko" },
      });
      const idx = r.data.inspectionResult?.indexStatusResult;
      console.log(url);
      console.log(`  coverage:  ${idx?.coverageState}`);
      console.log(`  robotsTxt: ${idx?.robotsTxtState}`);
      console.log(`  indexing:  ${idx?.indexingState}`);
      console.log(`  fetch:     ${idx?.pageFetchState}`);
      console.log(`  lastCrawl: ${idx?.lastCrawlTime || "(never)"}`);
      const sm = (idx as { sitemap?: string[] })?.sitemap;
      console.log(`  sitemap:   ${sm ? JSON.stringify(sm) : "(none)"}`);
      console.log();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`${url}\n  ERROR: ${msg}\n`);
    }
  }
})();
