"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Signup failed");
      setLoading(false);
      return;
    }
    const login = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (login?.error) {
      setError("Account created but login failed. Try logging in.");
      return;
    }
    router.refresh();
    router.push("/app/repositories");
  }

  return (
    <div className="w-full max-w-md">
      <div className="card-float rounded-xl bg-canvas p-8">
        <p className="font-mono text-xs uppercase tracking-wide text-mute">Get started</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your workspace.</h1>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-body">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
              placeholder="Jamie"
            />
          </div>
          <div>
            <label className="text-sm text-body">Work email</label>
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
            <label className="text-sm text-body">Password (min 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create workspace"}
          </Button>
        </form>
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => signIn("github", { callbackUrl: "/app/repositories" })}
          >
            Sign up with GitHub
          </Button>
        </div>
        <p className="mt-6 text-center text-sm text-body">
          Already have an account?{" "}
          <Link href="/login" className="text-link hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
