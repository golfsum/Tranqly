import Link from "next/link";

interface LegalPageProps {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}

export function LegalPage({ title, updated, intro, children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#090813] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-[#22162f] shadow-[0_0_32px_rgba(142,78,255,0.24)]">
              <span className="absolute inset-0 rounded-full bg-[#8e4eff]/25 blur-xl" />
              <img src="/tranqly_logo.png" alt="" className="relative h-7 w-7 object-contain" />
            </span>
            <span className="text-xl font-black">Tranqly: Daily Reflections</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white/80 hover:text-white"
          >
            Back home
          </Link>
        </header>

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(27,20,43,0.96),rgba(13,10,22,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d2a9ff]">Legal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm font-semibold text-white/48">Effective date: {updated}</p>
          <p className="mt-6 text-lg leading-8 text-white/72">{intro}</p>

          <div className="legal-content mt-10 space-y-8 text-white/72">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
      <div className="mt-3 space-y-3 leading-7">{children}</div>
    </section>
  );
}
