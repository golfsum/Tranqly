import SeoPage from "@/components/SeoPage";
import { linksWithout, seoMetadata } from "@/lib/seoPages";

const path = "/weekly-reflection";

export const metadata = seoMetadata(
  "Weekly Reflection That Connects Your Daily Check-Ins | Tranqly",
  "Bring a week of small reflections together. Tranqly highlights recurring themes, meaningful shifts, and one gentle focus for the week ahead.",
  path,
);

export default function WeeklyReflectionPage() {
  return (
    <SeoPage
      path={path}
      eyebrow="Weekly reflection"
      title="See the week as more than"
      accent="seven separate days."
      intro="A weekly reflection connects the small moments you may not notice one day at a time. Tranqly looks for grounded themes, changes, and what seemed to help."
      image="/coming-soon/journey.jpeg"
      imageAlt="Tranqly Journey showing reflection growth and weekly patterns"
      proof={["Built from your check-ins", "Past weeks stay available", "No 7-day streak required"]}
      sections={[
        { title: "Reflect when you can", body: "Weekly reflections are based on meaningful data, not perfect attendance. Three reflection days can be enough to begin seeing a thread." },
        { title: "Connect recurring moments", body: "Tranqly can compare the language, topics, and shifts across your week to surface what came up more than once or changed over time." },
        { title: "Carry one focus forward", body: "The summary ends with one gentle focus grounded in the week you shared, not a generic challenge or a list of tasks." },
        { title: "What a weekly reflection includes", body: "A weekly reflection may include the clearest theme, a meaningful change, what appeared to help, one pattern worth watching, and a gentle focus for the coming week." },
        { title: "What happens with fewer check-ins", body: "If there is not enough context yet, Tranqly tells you the reflection is still building. Missing a day does not erase progress or punish you." },
      ]}
      faq={[
        { question: "Do I need to reflect every day to get a weekly reflection?", answer: "No. Tranqly is designed to generate a weekly reflection when there is enough meaningful data, with three reflection days as the suggested minimum." },
        { question: "When is the weekly reflection available?", answer: "Tranqly is designed to prepare a weekly reflection on Sunday or at the end of a seven-day period when enough check-ins are available." },
        { question: "Can I read older weekly reflections?", answer: "Yes. Completed weekly reflections remain available in Journey so you can revisit how your themes changed over time." },
        { question: "Is a weekly reflection a mental health assessment?", answer: "No. It is a personal reflection summary based on what you shared. It is not diagnosis, treatment, or medical advice." },
      ]}
      related={linksWithout(path)}
    />
  );
}
