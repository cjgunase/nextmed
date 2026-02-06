"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

export type SiteHeaderProps = {
  transparentAtTopOnHome?: boolean;
};

export function SiteHeader({ transparentAtTopOnHome = true }: SiteHeaderProps) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isHomeTopTransparent = transparentAtTopOnHome && pathname === "/" && !isScrolled;

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-colors duration-300",
        isHomeTopTransparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-slate-800/50 bg-background/80 backdrop-blur-sm",
      )}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="NextMed.Ai Logo"
            width={32}
            height={32}
            className="rounded-md object-contain"
          />
          <span className="text-xl font-bold text-primary">NextMed.Ai</span>
        </Link>

        <div className="flex items-center gap-4">
          <ModeToggle />

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </SignInButton>

            <SignUpButton mode="modal">
              <Button variant="default" size="sm">
                Sign Up
              </Button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <Link href="/cases">
              <Button variant="ghost" size="sm">
                Cases
              </Button>
            </Link>
            <Link href="/ukmla">
              <Button variant="ghost" size="sm">
                UKMLA
              </Button>
            </Link>
            <Link href="/rivision">
              <Button variant="ghost" size="sm">
                Rivision
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm">
                🏆 Leaderboard
              </Button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
