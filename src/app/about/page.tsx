import type { Metadata } from "next";
import Link from "next/link";
import { Panel, Section } from "@/components/dashboard/section";
import { DISCLAIMER } from "@/lib/site";

export const metadata: Metadata = {
  title: "소개 및 면책",
  description: "KOSPI 공포·탐욕지수 사이트 소개와 면책 고지",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="flex max-w-3xl flex-col">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">소개</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        KOSPI 공포·탐욕지수는 한국 주식시장의 투자심리를 한눈에 볼 수 있도록 만든 0~100 점수입니다. 미국 시장에서 널리
        쓰이는 공포·탐욕지수의 아이디어를 참고해, 한국 시장에 맞는 지표(VKOSPI, 외국인 수급, KOSPI200 옵션 등)로 다시
        설계했습니다.
      </p>

      <Section id="how-to-read" title="어떻게 읽나요?">
        <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>점수가 낮을수록 시장 참여자들이 불안해하고(공포), 높을수록 낙관적입니다(탐욕).</li>
          <li>
            극단적인 공포·탐욕은 과열이나 투매 국면을 의미할 수 있지만, 그 자체로 매수·매도 시점을 알려주지는 않습니다.
          </li>
          <li>
            세부 지표 카드를 눌러 어떤 요인이 점수를 움직였는지 확인하고, 자세한 계산은{" "}
            <Link href="/methodology" className="text-foreground underline underline-offset-4">
              산출 방법
            </Link>
            에서 볼 수 있습니다.
          </li>
        </ul>
      </Section>

      <Section id="disclaimer" title="면책 고지">
        <Panel className="flex flex-col gap-3 text-sm leading-relaxed">
          <p className="font-semibold">{DISCLAIMER}</p>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5">
            <li>
              본 지수는 한국거래소(KRX) 또는 어떤 금융기관이 공표하는 공식 지수가 아니며, 본 사이트가 공개 데이터를
              바탕으로 자체 산출한 참고용 지표입니다.
            </li>
            <li>
              제공되는 정보는 투자 권유, 종목 추천, 매매 신호가 아닙니다. 모든 투자 판단과 그 결과에 대한 책임은 이용자
              본인에게 있습니다.
            </li>
            <li>
              데이터 수집·처리 과정에서 지연, 누락, 오류가 발생할 수 있으며, 일부 지표가 누락되면 나머지 지표로 가중치를
              재분배해 계산합니다.
            </li>
            <li>과거 지수와 이후 수익률 통계는 미래 성과를 보장하지 않습니다.</li>
            <li>
              데모 모드에서는 실제 시장 데이터가 아닌 시뮬레이션 데이터가 표시됩니다. 화면 상단의 안내 문구로 구분할 수
              있습니다.
            </li>
          </ul>
        </Panel>
      </Section>

      <Section id="data-policy" title="데이터 이용 원칙">
        <p className="text-muted-foreground text-sm leading-relaxed">
          본 사이트는 데이터 제공처의 이용약관을 위반하는 무단 크롤링을 하지 않습니다. 공식 Open API 또는 이용약관에 따라
          확보한 데이터만 사용하며, 사용 중인 출처는{" "}
          <Link href="/sources" className="text-foreground underline underline-offset-4">
            데이터 출처
          </Link>{" "}
          페이지에 공개합니다.
        </p>
      </Section>
    </article>
  );
}
