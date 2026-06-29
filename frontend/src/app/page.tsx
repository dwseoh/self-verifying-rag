import { MarketingNav } from "@/components/marketing/nav";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main>
        <section className="relative overflow-hidden border-b border-hairline bg-canvas">
          <div className="mesh-gradient absolute inset-0 opacity-80" aria-hidden />
          <div className="relative mx-auto max-w-[1400px] px-6 py-24 md:py-32">
            <span className="inline-flex rounded-full bg-canvas-soft px-3 py-1 font-mono text-xs text-body">
              Parallel verification on Cerebras
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-ink md:text-5xl md:leading-[1.05]">
              Verify every change before it ships.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-body">
              TrustLoop runs parallel Gemma micro-verifiers against your repo graph and engineering
              corpus — evidence-backed findings with citations, not chat guesses.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button size="lg" href="/signup">
                Start verifying
              </Button>
              <Button variant="secondary" size="lg" href="/app/repositories">
                Open dashboard
              </Button>
            </div>
          </div>
        </section>

        <section className="border-b border-hairline bg-canvas-soft py-24">
          <div className="mx-auto grid max-w-[1400px] gap-8 px-6 md:grid-cols-3">
            {[
              {
                title: "Connect repositories.",
                body: "Point TrustLoop at any git repo. Index Python and C/C++ dependency graphs incrementally.",
              },
              {
                title: "Bring your own key.",
                body: "Use your Cerebras API key. Inference runs on your account — we orchestrate parallel agents.",
              },
              {
                title: "Evidence, not vibes.",
                body: "Findings cite ADRs, conventions, and postmortems. Confidence is scored deterministically.",
              },
            ].map((card) => (
              <article key={card.title} className="card-float rounded-lg bg-canvas p-8">
                <h2 className="text-xl font-semibold tracking-tight text-ink">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-body">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-ink py-24 text-on-primary">
          <div className="mx-auto max-w-[1400px] px-6">
            <p className="font-mono text-xs uppercase tracking-wide text-on-primary/70">Developer platform</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              A compute model built for parallel assurance.
            </h2>
            <div className="mt-8 rounded-lg bg-[#0a0a0a] p-6 font-mono text-sm leading-6 text-on-primary/90">
              <p>POST /api/verify</p>
              <p className="text-on-primary/60">{`{ "repo_path": "your/repo", "changed_paths": ["src/api.py"] }`}</p>
              <p className="mt-4 text-cyan">→ 5 agents in parallel · ~700ms · findings + citations</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
