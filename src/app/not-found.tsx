import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-xl font-semibold">페이지를 찾을 수 없습니다</h1>
      <Link href="/" className="text-sm underline underline-offset-4">
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
