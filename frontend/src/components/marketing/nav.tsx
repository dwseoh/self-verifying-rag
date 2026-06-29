import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-xs font-semibold text-on-primary">
            TL
          </span>
          <span className="text-sm font-semibold tracking-tight">TrustLoop</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {["Product", "Docs", "Pricing"].map((item) => (
            <Link
              key={item}
              href="#"
              className="rounded-full px-3 py-1.5 text-sm text-body hover:bg-canvas-soft-2 hover:text-ink"
            >
              {item}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" href="/login">
            Log in
          </Button>
          <Button size="sm" href="/signup">
            Sign up
          </Button>
        </div>
      </div>
    </header>
  );
}
