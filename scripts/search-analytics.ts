import { google } from "googleapis";
import path from "path";

const SITE = "https://kstockflow.com/";
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

  const r = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(today),
      dimensions: ["date"],
      rowLimit: 30,
    },
  });

  console.log("=== 일별 노출/클릭 (28일) ===");
  console.log("날짜        노출    클릭   CTR     평균순위");
  for (const row of r.data.rows ?? []) {
    const d = row.keys?.[0];
    const i = row.impressions ?? 0;
    const c = row.clicks ?? 0;
    const ctr = ((row.ctr ?? 0) * 100).toFixed(2);
    const pos = (row.position ?? 0).toFixed(1);
    console.log(`${d}  ${String(i).padStart(5)}  ${String(c).padStart(4)}  ${ctr.padStart(5)}%  ${pos.padStart(6)}`);
  }

  // 주별 합산
  const total = (r.data.rows ?? []).reduce(
    (a, x) => ({
      imp: a.imp + (x.impressions ?? 0),
      clk: a.clk + (x.clicks ?? 0),
    }),
    { imp: 0, clk: 0 }
  );
  console.log();
  console.log(`28일 합계: 노출 ${total.imp} / 클릭 ${total.clk}`);

  // 페이지별 (어떤 페이지가 트래픽 받는지)
  const pageR = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(today),
      dimensions: ["page"],
      rowLimit: 15,
    },
  });
  console.log();
  console.log("=== 28일 페이지별 노출/클릭 TOP 15 ===");
  for (const row of pageR.data.rows ?? []) {
    const url = (row.keys?.[0] ?? "").replace("https://kstockflow.com", "");
    console.log(
      `imp=${String(row.impressions).padStart(4)} clk=${String(row.clicks).padStart(3)} pos=${(row.position ?? 0).toFixed(1).padStart(5)} ${url}`
    );
  }
})();
