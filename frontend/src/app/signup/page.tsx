import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-soft px-6">
      <div className="card-float w-full max-w-md rounded-xl bg-canvas p-8">
        <p className="font-mono text-xs uppercase tracking-wide text-mute">Get started</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your workspace.</h1>
        <form className="mt-8 space-y-4">
          <div>
            <label className="text-sm text-body">Work email</label>
            <input
              type="email"
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="text-sm text-body">Organization</label>
            <input
              type="text"
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
              placeholder="Acme Engineering"
            />
          </div>
          <Button className="w-full" href="/app/repositories">
            Create workspace
          </Button>
        </form>
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
