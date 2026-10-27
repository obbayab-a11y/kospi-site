import Link from "next/link";
import { Gauge } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";

export const NAV_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/history", label: "과거 데이터" },
  { href: "/methodology", label: "산출 방법" },
  { href: "/sources", label: "데이터 출처" },
  { href: "/about", label: "소개" },
] as const;

export function SiteHeader() {
  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Gauge className="size-5" aria-hidden />
          <span className="text-[15px]">KOSPI 공포·탐욕지수</span>
        </Link>
        <nav aria-label="주요 메뉴" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center md:ml-0">
          <ThemeToggle />
          <MobileNav items={NAV_ITEMS} />
        </div>
      </div>
    </header>
  );
}
