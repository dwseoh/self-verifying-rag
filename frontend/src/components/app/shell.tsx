"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/app/repositories", label: "Repositories" },
  { href: "/app/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-canvas-soft">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-xs font-semibold text-on-primary">
                TL
              </span>
              <span className="text-sm font-semibold">TrustLoop</span>
            </Link>
            <nav className="flex items-center gap-1">
              {links.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-sm px-3 py-1.5 text-sm ${
                      active ? "bg-canvas-soft-2 font-medium text-ink" : "text-body hover:text-ink"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-body">
            {session?.user?.email && <span className="hidden sm:inline">{session.user.email}</span>}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-link hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  );
}
