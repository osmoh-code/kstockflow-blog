import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-6xl font-extrabold text-gray-900">404</h1>
      <p className="mb-6 text-lg text-gray-500">
        요청하신 페이지를 찾을 수 없습니다.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
