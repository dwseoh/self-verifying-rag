import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-soft px-6">
      <div className="card-float w-full max-w-md rounded-xl bg-canvas p-8">
        <p className="font-mono text-xs uppercase tracking-wide text-mute">Welcome back</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Log in to TrustLoop.</h1>
        <form className="mt-8 space-y-4">
          <div>
            <label className="text-sm text-body">Email</label>
            <input
              type="email"
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="text-sm text-body">Password</label>
            <input
              type="password"
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
            />
          </div>
          <Button className="w-full" href="/app/repositories">
            Continue
          </Button>
        </form>
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
