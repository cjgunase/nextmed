import Link from "next/link";
import Image from "next/image";

const productLinks = [
  { label: "Clinical Cases", href: "/cases" },
  { label: "UKMLA Practice", href: "/ukmla" },
  { label: "Performance", href: "/performance" },
  { label: "Review", href: "/review" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
];

const trustLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Data Security", href: "/security" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/logo.png"
                alt="NextMed.Ai Logo"
                width={28}
                height={28}
                className="rounded-md object-contain"
              />
              <span className="text-lg font-semibold text-foreground">NextMed.Ai</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              NextMed helps medical students build clinical reasoning through structured case practice, exam-focused
              revision, and measurable progress.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-4 space-y-2">
              {productLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Company</h3>
            <ul className="mt-4 space-y-2">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Trust & Legal</h3>
            <ul className="mt-4 space-y-2">
              {trustLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 space-y-2 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Built with clinician and educator input.</p>
          <p className="text-sm text-muted-foreground">
            For educational use only. Not intended for clinical decision-making or patient care.
          </p>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} NextMed. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
