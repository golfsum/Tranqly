import SeoPage from "@/components/SeoPage";
import { linksWithout, seoMetadata, softwareApplicationJsonLd } from "@/lib/seoPages";

const path = "/how-tranqly-works";

export const metadata = seoMetadata(
  "How Tranqly Works: Reflect, Notice, Grow, Explore",
  "Learn how Tranqly turns a 60-second voice or text reflection into a thoughtful insight, weekly patterns, and peaceful sanctuary progress.",
  path,
);

export default function HowTranqlyWorksPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }} />
      <SeoPage
        path={path}
        eyebrow="How Tranqly works"
        title="Reflect. Notice. Grow."
        accent="Explore."
        intro="Tranqly gives one minute of daily reflection somewhere to go. Your check-ins become thoughtful observations, weekly perspective, and a sanctuary collection that grows without streak pressure."
        image="/coming-soon/insights.jpeg"
        imageAlt="Tranqly daily reflection screen showing a prompt, microphone, insight, and weekly progress"
        proof={["One primary action", "Context grows over time", "You keep your history"]}
        sections={[
          { title: "Reflect", body: "Answer one changing prompt or share whatever is on your mind. Speak for up to 60 seconds or type. One honest sentence is enough." },
          { title: "Notice", body: "Tranqly responds with one grounded observation, a memorable insight, and a gentle next step when it fits the context." },
          { title: "Grow", body: "Daily entries build a private Journey with recent reflections, recurring themes, weekly summaries, and a clearer view of what has been changing." },
          { title: "Explore", body: "Lifetime reflection days unlock peaceful sanctuaries. Progress never resets when you miss a day, and every place you earn remains available." },
          { title: "Your first week", body: "The complimentary first week gives you the full experience. At the end, your first weekly reflection and existing history remain yours whether or not you continue with Tranqly Plus." },
          { title: "After the first week", body: "You can revisit what you already created. Continuing unlocks more weeks of thoughtful responses, weekly reflections, personal guidance, and sanctuary progress." },
      ]}
        faq={[
          { question: "How much time does Tranqly take each day?", answer: "The main reflection is designed for up to 60 seconds by voice, though you can type and take more or less time whenever you prefer." },
          { question: "What does Tranqly remember?", answer: "Tranqly can use the reflection history and patterns you choose to save to personalize prompts and responses. It should not make assumptions beyond the context you shared." },
          { question: "What can I keep if I do not continue after the first week?", answer: "Your first week, saved reflections, first weekly reflection, and earned sanctuary remain available to revisit." },
          { question: "Is Tranqly a therapy app?", answer: "No. Tranqly is a private daily reflection companion. It is not therapy, diagnosis, crisis support, or professional advice." },
        ]}
        related={linksWithout(path)}
      />
    </>
  );
}
