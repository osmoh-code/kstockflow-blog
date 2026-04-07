/**
 * One-time YouTube OAuth 2.0 refresh token bootstrapper.
 *
 * Usage:
 *   npx tsx scripts/shorts/get-refresh-token.ts
 *
 * Flow:
 *   1. Reads .youtube-oauth-client.json (downloaded from Google Cloud Console)
 *   2. Starts a local HTTP server on http://localhost:3030
 *   3. Prints an authorization URL — user opens it in browser
 *   4. User signs in to Google account that owns the YouTube channel
 *   5. User grants youtube.upload scope
 *   6. Google redirects to localhost:3030/oauth2callback?code=...
 *   7. Script exchanges code → access_token + refresh_token
 *   8. Prints refresh_token to add to .env.local
 *
 * After running once, add the printed value to .env.local:
 *   YOUTUBE_REFRESH_TOKEN=1//abc...
 *
 * Then never run this script again — refresh tokens don't expire (unless revoked).
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { google } from "googleapis";
import { loadOAuthClientConfig, YOUTUBE_SCOPES } from "./lib/youtube-oauth";

/**
 * Write the auth URL to a temp HTML file with auto-redirect, then open it.
 * This avoids any issues with copy-paste truncation or shell argument escaping.
 */
function openAuthInBrowser(url: string): string {
  const tmpFile = path.join(process.cwd(), ".oauth-redirect.html");
  const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>OAuth Redirect</title>
<meta http-equiv="refresh" content="0;url=${url}">
</head><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;text-align:center;padding:60px;">
<h2>Google OAuth로 이동 중...</h2>
<p>자동 이동되지 않으면 <a href="${url}">여기를 클릭</a>하세요.</p>
</body></html>`;
  fs.writeFileSync(tmpFile, html, "utf-8");

  // Open the local HTML file in the default browser
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", tmpFile], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [tmpFile], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [tmpFile], { detached: true, stdio: "ignore" }).unref();
  }

  return tmpFile;
}

const PORT = 3030;
// Use root path so the redirect_uri matches the simplest form registered
// in Google Cloud Console. The local server accepts ANY path with a code.
const REDIRECT_URI = `http://localhost:${PORT}`;

async function main(): Promise<void> {
  const config = loadOAuthClientConfig();

  const oAuth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, REDIRECT_URI);

  // Generate authorization URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: YOUTUBE_SCOPES,
  });

  console.log("\n═══════════════════════════════════════════════");
  console.log("🔐 YouTube OAuth 2.0 Refresh Token 발급");
  console.log("═══════════════════════════════════════════════\n");
  console.log("📡 임시 HTML 파일을 만들고 브라우저로 엽니다...\n");
  const tmpFile = openAuthInBrowser(authUrl);
  console.log(`   파일: ${tmpFile}`);
  console.log(`   브라우저가 자동으로 열리고 Google 로그인 페이지로 redirect됩니다.\n`);
  console.log(`동의 후 http://localhost:${PORT} 로 자동 리다이렉트됩니다.\n`);

  // Start local HTTP server
  const code = await waitForCode();
  console.log(`\n✅ 인증 코드 수신`);

  // Exchange code for tokens
  console.log("🔄 토큰 교환 중...");
  const { tokens } = await oAuth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error("\n❌ refresh_token이 응답에 없습니다.");
    console.error("   이미 인증한 적이 있다면 다음 URL에서 권한을 해제 후 재시도:");
    console.error("   https://myaccount.google.com/permissions");
    process.exit(1);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("✅ Refresh Token 발급 완료!");
  console.log("═══════════════════════════════════════════════\n");
  console.log(".env.local 파일에 다음 줄 추가:\n");
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  console.log("저장 후 'npm run shorts:upload <slug>' 명령으로 영상 업로드 가능합니다.\n");
}

function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        if (!req.url) return;
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h1>OAuth 오류</h1><p>${error}</p>`);
          server.close();
          reject(new Error(error));
          return;
        }
        if (!code) {
          // No code yet (e.g., favicon request) — return 200 empty
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Waiting for OAuth callback...");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><html><head><meta charset="utf-8"><title>인증 완료</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0a;color:#fff;"><h1>✅ 인증 완료</h1><p>이 창을 닫고 터미널로 돌아가세요.</p></body></html>`);
        server.close();
        resolve(code);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(500);
        res.end(msg);
        server.close();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    server.listen(PORT, () => {
      console.log(`📡 로컬 콜백 서버 대기 중: http://localhost:${PORT}\n`);
    });
  });
}

// Load .env.local
import fs from "node:fs";
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

main().catch((err) => {
  console.error("\n❌ 실패:", err);
  process.exit(1);
});
