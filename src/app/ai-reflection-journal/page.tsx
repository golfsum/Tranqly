import SeoPage from "@/components/SeoPage";
import { linksWithout, seoMetadata, softwareApplicationJsonLd } from "@/lib/seoPages";

const path = "/ai-reflection-journal";

export const metadata = seoMetadata(
  "AI Reflection Journal That Notices Patterns | Tranqly",
  "Reflect by voice or text in one minute. Tranqly responds thoughtfully, remembers recurring themes, and helps you understand your days over time.",
  path,
);

export default function AiReflectionJournalPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }} />
      <SeoPage
        path={path}
        eyebrow="AI reflection journal"
        title="A journal that helps you"
        accent="notice more."
        intro="Tranqly turns a short voice or text reflection into one grounded observation. As you return, it can connect recurring themes so each check-in becomes more useful than the last."
        image="/coming-soon/insights.jpeg"
        imageAlt="Tranqly showing a daily reflection prompt and personalized insight"
        proof={["Voice or text", "Thoughtful AI responses", "Patterns over time"]}
        sections={[
          { title: "Share one honest moment", body: "Speak for up to 60 seconds or type what happened. There is no rigid template and no pressure to turn an ordinary day into a breakthrough." },
          { title: "Receive an observation", body: "Tranqly looks beyond a recap to notice a shift, mixed feeling, or connection grounded in what you actually shared. It does not diagnose or pretend to know more than you said." },
          { title: "Build useful context", body: "Recurring themes can shape future prompts and weekly reflections. The goal is not endless advice. It is a clearer view of what keeps showing up in your life." },
          { title: "What makes an AI reflection useful?", body: "A useful response should reveal something without inventing a story. Tranqly is designed to distinguish what happened from why it may matter, then offer a gentle next step only when one fits." },
          { title: "Reflection, not therapy", body: "Tranqly is a private self-reflection tool, not a therapist, medical provider, crisis service, or source of professional advice. Its responses are prompts for your own thinking." },
        ]}
        faq={[
          { question: "What is an AI reflection journal?", answer: "An AI reflection journal uses the thoughts you choose to share to generate prompts, observations, summaries, or patterns. Tranqly focuses on brief daily reflection and grounded, non-clinical responses." },
          { question: "Does Tranqly just summarize my entry?", answer: "Tranqly is designed to identify one meaningful observation instead of only repeating events. The observation must stay grounded in your words and avoid invented facts or certainty." },
          { question: "Can I use Tranqly without speaking?", answer: "Yes. Every daily reflection can be typed. Voice is optional and is transcribed so you can review what was captured." },
          { question: "Is Tranqly therapy or medical advice?", answer: "No. Tranqly supports personal reflection. It does not diagnose, treat, replace professional care, or provide crisis support." },
        ]}
        related={linksWithout(path)}
      />
    </>
  );
}
