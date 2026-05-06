import { google } from "googleapis";
import path from "path";

const SITE = "https://kstockflow.com/";
const TARGET = "https://kstockflow.com/posts/2026-04-23-ai-power-suyo-geubjeung-stocks/";

const credPath = path.join(process.cwd(), "google-credentials.json");
const auth = new google.auth.GoogleAuth({
  keyFile: credPath,
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
});
const sc = google.searchconsole({ version: "v1", auth: auth as never });

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

(async () => {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 28);

  // 이 페이지로 노출된 검색 query
  const r = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(today),
      dimensions: ["query"],
      dimensionFilterGroups: [
        {
          filters: [{ dimension: "page", operator: "equals", expression: TARGET }],
        },
      ],
      rowLimit: 25,
    },
  });

  console.log(`=== ${TARGET} 28일 검색 query TOP 25 ===`);
  console.log("query".padEnd(40) + "  imp  clk  CTR%   pos");
  for (const row of r.data.rows ?? []) {
    const q = (row.keys?.[0] ?? "").slice(0, 38);
    const i = row.impressions ?? 0;
    const c = row.clicks ?? 0;
    const ctr = ((row.ctr ?? 0) * 100).toFixed(1);
    const pos = (row.position ?? 0).toFixed(1);
    console.log(
      `${q.padEnd(40)}  ${String(i).padStart(4)}  ${String(c).padStart(3)}  ${ctr.padStart(4)}  ${pos.padStart(5)}`
    );
  }
})();
