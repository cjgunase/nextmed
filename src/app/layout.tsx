import type { Metadata } from "next";
import { Inter } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NextMed.ai Medical Learning Platform",
  description: "Advanced healthcare solutions built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className} antialiased bg-background text-foreground`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/50 bg-background/80 backdrop-blur-sm">
              <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
            <div className="pt-16">{children}</div>
            <SiteFooter />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
