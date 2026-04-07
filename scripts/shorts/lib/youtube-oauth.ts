/**
 * YouTube OAuth 2.0 helper.
 *
 * Loads the OAuth client config from `.youtube-oauth-client.json` (downloaded
 * from Google Cloud Console) and creates an authenticated OAuth2Client.
 *
 * The refresh token is stored in `.env.local` as YOUTUBE_REFRESH_TOKEN
 * after running `get-refresh-token.ts` once.
 */

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const CLIENT_JSON_PATH = path.join(process.cwd(), ".youtube-oauth-client.json");

/**
 * Scopes required:
 *  - youtube.upload    : 영상 업로드
 *  - youtube.force-ssl : 영상 삭제, 댓글 추가, 메타데이터 수정 등
 */
export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

interface ClientSecret {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

export interface OAuthClientConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

/**
 * Read the OAuth client JSON downloaded from Google Cloud Console.
 * Throws if the file is missing.
 */
export function loadOAuthClientConfig(): OAuthClientConfig {
  if (!fs.existsSync(CLIENT_JSON_PATH)) {
    throw new Error(
      `OAuth 클라이언트 JSON 파일 없음: ${CLIENT_JSON_PATH}\n\n` +
        `Google Cloud Console에서 OAuth 클라이언트(데스크톱 앱) JSON을 다운로드 후\n` +
        `.youtube-oauth-client.json 이름으로 프로젝트 루트에 저장하세요.`,
    );
  }
  const raw = fs.readFileSync(CLIENT_JSON_PATH, "utf-8");
  const json = JSON.parse(raw) as ClientSecret;
  const installed = json.installed ?? json.web;
  if (!installed) {
    throw new Error("OAuth client JSON 형식 오류 (installed 또는 web 필드 없음)");
  }
  return {
    clientId: installed.client_id,
    clientSecret: installed.client_secret,
    redirectUri: installed.redirect_uris?.[0] ?? "http://localhost:3030/oauth2callback",
  };
}

/**
 * Create an authenticated OAuth2Client using the saved refresh token.
 * Throws if YOUTUBE_REFRESH_TOKEN is missing from env.
 */
export function createAuthenticatedClient(): OAuth2Client {
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "YOUTUBE_REFRESH_TOKEN 누락. 다음 명령으로 1회 발급 후 .env.local에 저장하세요:\n" +
        "  npx tsx scripts/shorts/get-refresh-token.ts",
    );
  }
  const config = loadOAuthClientConfig();
  const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
