import Link from "next/link";
import { DISCLAIMER } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:px-6">
        <p className="text-foreground font-medium">{DISCLAIMER}</p>
        <p>
          KOSPI 공포·탐욕지수는 한국거래소(KRX)가 공표하는 공식 지수가 아니며, 공개 시장 데이터를 바탕으로
          본 사이트가 자체적으로 산출한 투자심리 참고 지표입니다. 데이터 지연·오류가 있을 수 있으며 투자 판단의
          책임은 이용자 본인에게 있습니다.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/methodology" className="hover:text-foreground underline-offset-4 hover:underline">
            산출 방법
          </Link>
          <Link href="/sources" className="hover:text-foreground underline-offset-4 hover:underline">
            데이터 출처
          </Link>
          <Link href="/about" className="hover:text-foreground underline-offset-4 hover:underline">
            소개 및 면책
          </Link>
          <Link href="/api/fear-greed/current" className="hover:text-foreground underline-offset-4 hover:underline">
            API
          </Link>
        </div>
      </div>
    </footer>
  );
}
