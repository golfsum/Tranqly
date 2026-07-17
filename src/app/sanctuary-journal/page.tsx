import SeoPage from "@/components/SeoPage";
import { linksWithout, seoMetadata } from "@/lib/seoPages";

const path = "/sanctuary-journal";

export const metadata = seoMetadata(
  "A Reflection Journal with Peaceful Sanctuaries | Tranqly",
  "Unlock calming sanctuary themes as your lifetime reflection days grow. Missed days never remove progress, and every earned sanctuary stays yours.",
  path,
);

export default function SanctuaryJournalPage() {
  return (
    <SeoPage
      path={path}
      eyebrow="Sanctuary journal"
      title="Let your reflection journey become a"
      accent="place you can see."
      intro="Tranqly pairs daily reflection with a collection of peaceful sanctuaries. New places unlock through lifetime reflection days, so progress moves forward without streak pressure."
      image="/coming-soon/themes.jpeg"
      imageAlt="Tranqly sanctuary theme collection with peaceful illustrated environments"
      proof={["Lifetime progress", "No streak punishment", "Earned themes stay yours"]}
      sections={[
        { title: "Begin with a place that fits", body: "Cloud Sanctuary, Twilight Grove, and Blossom Garden offer distinct moods from the beginning without overwhelming you with choices." },
        { title: "Grow through reflection days", body: "One or more check-ins on a calendar day count as one reflection day. Multiple entries do not inflate progress, and missed days never remove what you earned." },
        { title: "Keep every sanctuary", body: "When a new sanctuary unlocks, it stays in your collection. You can preview available places and choose the environment that feels right." },
        { title: "Progress without pressure", body: "Sanctuary progression rewards returning over time rather than maintaining a perfect streak. If life gets busy, your lifetime reflection day total remains intact." },
        { title: "A visual memory of showing up", body: "The sanctuary is not a score or leaderboard. It is a calm visual reminder that small, honest check-ins can accumulate into something meaningful." },
      ]}
      faq={[
        { question: "How do sanctuary themes unlock?", answer: "Themes unlock through lifetime reflection days. At least one completed reflection on a calendar day counts as one reflection day." },
        { question: "What happens if I miss a day?", answer: "Nothing is taken away. Your reflection day total never decreases, and a missed day does not reset sanctuary progress." },
        { question: "Do multiple reflections in one day unlock themes faster?", answer: "No. Multiple reflections on the same calendar day count as one reflection day for sanctuary progression." },
        { question: "Can I switch back to an older sanctuary?", answer: "Yes. Sanctuaries you have earned remain available to preview and select." },
      ]}
      related={linksWithout(path)}
    />
  );
}
