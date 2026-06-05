const highlights = [
  {
    label: "Type safety",
    value: "Strict by default",
    detail: "Tighter compiler checks catch bugs before they ship.",
  },
  {
    label: "Rendering",
    value: "React Compiler ready",
    detail: "Let the compiler optimize re-renders without manual memoization.",
  },
  {
    label: "Tooling",
    value: "Fast feedback loop",
    detail: "Ultracite keeps formatting and linting consistent.",
  },
] as const;

const principles = [
  "Server-first architecture with the App Router.",
  "Responsive layouts that work from the first render.",
  "Design tokens and semantic markup for maintainability.",
] as const;

export default function Home(): React.JSX.Element {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(245,247,255,0.9)_36%,_rgba(235,239,255,0.8)_100%)] text-slate-950">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(15,23,42,0.06),transparent_35%,rgba(56,189,248,0.08)_68%,rgba(99,102,241,0.1))]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-slate-200/80 border-b pb-6">
          <div>
            <p className="font-medium text-slate-500 text-sm uppercase tracking-[0.24em]">
              Hub
            </p>
            <p className="mt-1 text-slate-600 text-sm">
              Modern Next.js starter with strict TypeScript.
            </p>
          </div>
          <a
            className="rounded-full border border-slate-300/80 bg-white/70 px-4 py-2 font-medium text-slate-700 text-sm shadow-sm backdrop-blur transition hover:border-slate-400 hover:text-slate-950"
            href="https://nextjs.org/docs"
            rel="noopener noreferrer"
            target="_blank"
          >
            Next.js docs
          </a>
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/75 px-4 py-2 font-medium text-slate-600 text-sm shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              App Router, React 19, Tailwind v4
            </div>
            <h1 className="mt-6 max-w-2xl font-semibold text-5xl text-slate-950 tracking-tight sm:text-6xl lg:text-7xl">
              A cleaner foundation for modern web apps.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600 leading-8 sm:text-xl">
              This starter is configured for stronger type safety, faster React
              rendering, and a more intentional first screen so new work starts
              from a polished baseline.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 font-semibold text-sm text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                href="https://nextjs.org/learn"
                rel="noopener noreferrer"
                target="_blank"
              >
                Explore the platform
              </a>
              <a
                className="inline-flex items-center justify-center rounded-full border border-slate-300/80 bg-white/70 px-5 py-3 font-semibold text-slate-700 text-sm shadow-sm backdrop-blur transition hover:border-slate-400 hover:text-slate-950"
                href="https://react.dev/learn"
                rel="noopener noreferrer"
                target="_blank"
              >
                Build with React 19
              </a>
            </div>

            <ul className="mt-10 grid gap-3 text-slate-600 text-sm sm:grid-cols-3">
              {principles.map((principle) => (
                <li
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur"
                  key={principle}
                >
                  {principle}
                </li>
              ))}
            </ul>
          </div>

          <aside className="grid gap-4">
            {highlights.map((highlight, index) => (
              <article
                className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur"
                key={highlight.label}
              >
                <p className="font-medium text-slate-500 text-sm uppercase tracking-[0.2em]">
                  0{index + 1}
                </p>
                <h2 className="mt-3 font-semibold text-2xl text-slate-950">
                  {highlight.value}
                </h2>
                <p className="mt-3 text-slate-600 text-sm leading-7">
                  {highlight.detail}
                </p>
              </article>
            ))}
          </aside>
        </section>
      </div>
    </main>
  );
}
