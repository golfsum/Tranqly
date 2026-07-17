import Image from "next/image";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

export interface SeoPageSection {
  title: string;
  body: string;
}

export interface SeoPageFaq {
  question: string;
  answer: string;
}

export interface SeoRelatedLink {
  href: string;
  title: string;
  description: string;
}

interface SeoPageProps {
  eyebrow: string;
  title: string;
  accent: string;
  intro: string;
  image: string;
  imageAlt: string;
  proof: string[];
  sections: SeoPageSection[];
  faq: SeoPageFaq[];
  related: SeoRelatedLink[];
  path: string;
}

function LotusMark() {
  return (
    <Image
      src="/tranqly_logo.png"
      alt=""
      width={48}
      height={48}
      className="h-11 w-11 rounded-xl object-contain shadow-[0_0_28px_rgba(168,85,247,0.32)]"
      priority
    />
  );
}

export default function SeoPage({
  eyebrow,
  title,
  accent,
  intro,
  image,
  imageAlt,
  proof,
  sections,
  faq,
  related,
  path,
}: SeoPageProps) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Tranqly", item: absoluteUrl() },
      { "@type": "ListItem", position: 2, name: title, item: absoluteUrl(path) },
    ],
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#090713] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(132,63,246,0.18),transparent_30%),radial-gradient(circle_at_8%_45%,rgba(198,91,255,0.08),transparent_28%)]" />

      <header className="relative z-10 border-b border-white/[0.07] bg-[#090713]/85 px-5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-5">
          <Link href="/" className="flex items-center gap-3" aria-label="Tranqly home">
            <LotusMark />
            <span className="hidden text-lg font-black tracking-tight sm:inline">Tranqly: Daily Reflections</span>
            <span className="text-lg font-black tracking-tight sm:hidden">Tranqly</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold text-white/65" aria-label="Primary navigation">
            <Link href="/how-tranqly-works" className="hidden rounded-full px-4 py-2 transition hover:bg-white/[0.05] hover:text-white sm:block">How it works</Link>
            <Link href="/#pricing" className="rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] px-5 py-3 text-white shadow-[0_12px_34px_rgba(124,58,237,0.28)] transition hover:brightness-110">Get started</Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:pb-28 lg:pt-24">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#c69cff]">{eyebrow}</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            {title} <span className="bg-gradient-to-r from-[#b37cff] via-[#d394ff] to-[#8f65ff] bg-clip-text text-transparent">{accent}</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/68 sm:text-xl sm:leading-9">{intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {proof.map((item) => (
              <span key={item} className="rounded-full border border-[#9f75d8]/35 bg-[#241834]/75 px-4 py-2 text-sm font-bold text-[#ddc8f7]">{item}</span>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/#pricing" className="inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] px-8 font-black text-white shadow-[0_16px_42px_rgba(124,58,237,0.35)] transition hover:-translate-y-0.5 hover:brightness-110">Start reflecting</Link>
            <Link href="/daily-reflection-prompts" className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-8 font-bold text-white/82 transition hover:bg-white/[0.08] hover:text-white">Try a reflection prompt</Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[430px]">
          <div className="absolute inset-8 rounded-[42px] bg-[#8f48ff]/25 blur-3xl" />
          <div className="relative overflow-hidden rounded-[42px] border border-white/12 bg-[#100c1c] p-2 shadow-[0_34px_100px_rgba(0,0,0,0.58)]">
            <Image src={image} alt={imageAlt} width={844} height={1833} className="h-auto w-full rounded-[34px]" priority />
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/[0.07] bg-white/[0.025]">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-16 sm:px-8 md:grid-cols-3 md:py-20">
          {sections.slice(0, 3).map((section, index) => (
            <article key={section.title} className="rounded-[28px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(29,21,47,0.9),rgba(15,11,25,0.92))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ae7cff]/35 bg-[#7c3aed]/15 text-sm font-black text-[#d8b8ff]">0{index + 1}</span>
              <h2 className="mt-6 text-2xl font-black tracking-tight">{section.title}</h2>
              <p className="mt-3 leading-7 text-white/62">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      {sections.length > 3 ? (
        <section className="relative mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-center text-xs font-black uppercase tracking-[0.3em] text-[#c69cff]">A calmer way to notice more</p>
          <div className="mt-10 space-y-5">
            {sections.slice(3).map((section) => (
              <article key={section.title} className="rounded-[28px] border border-white/[0.09] bg-[#171124]/86 p-7 sm:p-9">
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{section.title}</h2>
                <p className="mt-4 text-lg leading-8 text-white/64">{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="relative mx-auto max-w-4xl px-5 pb-20 sm:px-8 sm:pb-28">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#c69cff]">Questions, answered calmly</p>
        <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Frequently asked questions</h2>
        <div className="mt-10 divide-y divide-white/[0.08] overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#151020]/90">
          {faq.map((item) => (
            <details key={item.question} className="group p-6 open:bg-white/[0.025] sm:p-7">
              <summary className="cursor-pointer list-none pr-8 text-lg font-black marker:hidden">{item.question}<span className="float-right text-[#c69cff] transition group-open:rotate-45">+</span></summary>
              <p className="mt-4 max-w-3xl leading-7 text-white/62">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="relative border-y border-white/[0.07] bg-[#120d1e]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-3xl font-black tracking-tight">Explore Tranqly</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-[24px] border border-white/[0.09] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-[#a876e8]/45 hover:bg-white/[0.05]">
                <h3 className="text-lg font-black group-hover:text-[#d7b8ff]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.description}</p>
                <span className="mt-5 inline-block text-sm font-black text-[#c69cff]">Read more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 sm:py-28">
        <LotusMark />
        <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">One minute today. More understanding tomorrow.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/62">Reflect by voice or text. Tranqly helps you notice what matters without pressure, judgment, or streak anxiety.</p>
        <Link href="/#pricing" className="mt-9 inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] px-9 font-black text-white shadow-[0_16px_42px_rgba(124,58,237,0.35)] transition hover:brightness-110">Get started with Tranqly</Link>
      </section>

      <footer className="relative border-t border-white/[0.07] px-5 py-8 text-sm text-white/48 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Tranqly. A private daily reflection companion.</span>
          <nav className="flex flex-wrap gap-5" aria-label="Footer navigation">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <a href="mailto:support@tranqly.com" className="hover:text-white">Support</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
