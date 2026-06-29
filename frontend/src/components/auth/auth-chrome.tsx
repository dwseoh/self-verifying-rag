import Link from "next/link";

export function AuthChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-soft">
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-body transition hover:text-ink"
            >
              ← Home
            </Link>
            <span className="h-4 w-px bg-hairline" aria-hidden />
            <Link href="/" className="flex items-center gap-2 text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-xs font-semibold text-on-primary">
                TL
              </span>
              <span className="text-sm font-semibold tracking-tight">TrustLoop</span>
            </Link>
          </div>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">{children}</div>
    </div>
  );
}
