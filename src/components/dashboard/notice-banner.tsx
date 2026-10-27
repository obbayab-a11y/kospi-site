import Link from "next/link";
import { AlertTriangle, FlaskConical } from "lucide-react";
import type { FearGreedSnapshot } from "@/lib/data/fear-greed-service";

/** 데모 모드 / 데이터 지연 / 일부 지표 누락 안내 */
export function NoticeBanner({ snapshot }: { snapshot: FearGreedSnapshot }) {
  const items: { icon: "demo" | "warn"; text: string }[] = [];
  if (snapshot.effectiveMode === "demo") {
    items.push({
      icon: "demo",
      text: "데모 모드: 실제 시장 데이터가 아닌 시뮬레이션 데이터로 표시 중입니다.",
    });
  }
  for (const n of snapshot.notices) items.push({ icon: "warn", text: n });
  if (items.length === 0) return null;

  return (
    <div role="status" className="bg-muted/60 text-muted-foreground mb-6 flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-sm">
      {items.map((item) => (
        <p key={item.text} className="flex items-start gap-2">
          {item.icon === "demo" ? (
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>
            {item.text}
            {item.icon === "demo" && (
              <>
                {" "}
                <Link href="/sources" className="text-foreground underline underline-offset-4">
                  데이터 출처 보기
                </Link>
              </>
            )}
          </span>
        </p>
      ))}
    </div>
  );
}
