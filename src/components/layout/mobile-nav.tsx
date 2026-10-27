"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function MobileNav({ items }: { items: readonly { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent className="top-4 translate-y-0 sm:max-w-sm">
        <DialogTitle>메뉴</DialogTitle>
        <nav aria-label="모바일 메뉴" className="flex flex-col">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="hover:bg-accent rounded-md px-2 py-3 text-base"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
