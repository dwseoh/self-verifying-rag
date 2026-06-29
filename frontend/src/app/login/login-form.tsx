"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/app/repositories";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.refresh();
    router.push(callbackUrl);
  }

  return (
    <div className="w-full max-w-md">
      <div className="card-float rounded-xl bg-canvas p-8">
        <p className="font-mono text-xs uppercase tracking-wide text-mute">Welcome back</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Log in to TrustLoop.</h1>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-body">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="text-sm text-body">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Continue"}
          </Button>
        </form>
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => signIn("github", { callbackUrl })}
          >
            Continue with GitHub
          </Button>
        </div>
        <p className="mt-6 text-center text-sm text-body">
          No account?{" "}
          <Link href="/signup" className="text-link hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
