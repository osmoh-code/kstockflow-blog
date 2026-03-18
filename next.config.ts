import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // 개발 모드에서는 export 비활성화 (새 글 추가 시 에러 방지)
  // Vercel 배포 시에는 자동으로 production이므로 export 적용됨
  ...(isDev ? {} : { output: "export" }),
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
