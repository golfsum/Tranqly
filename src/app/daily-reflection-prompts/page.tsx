import SeoPage from "@/components/SeoPage";
import { linksWithout, seoMetadata } from "@/lib/seoPages";

const path = "/daily-reflection-prompts";

export const metadata = seoMetadata(
  "Daily Reflection Prompts for Calm and Clarity | Tranqly",
  "Try 21 gentle daily reflection questions for gratitude, difficult days, small wins, growth, and tomorrow. Start with one honest sentence.",
  path,
);

export default function DailyReflectionPromptsPage() {
  return (
    <SeoPage
      path={path}
      eyebrow="Daily reflection prompts"
      title="One good question can"
      accent="open the day."
      intro="You do not need a perfect journal entry. Choose one question, answer with one true sentence, and stop when you have said enough."
      image="/coming-soon/insights.jpeg"
      imageAlt="Tranqly daily reflection prompt with voice and text controls"
      proof={["21 questions", "No perfect answer", "One minute is enough"]}
      sections={[
        { title: "Notice today", body: "What felt easier than expected? What took more energy than you planned? What moment do you want to remember? What surprised you today?" },
        { title: "Find a small win", body: "What are you quietly proud of? Where did you show up even when it was difficult? What did you finish, begin, or make a little lighter?" },
        { title: "Name what helped", body: "What gave you energy? What helped you feel calmer? Who or what made the day feel more manageable? When did you feel most like yourself?" },
        { title: "Make room for gratitude", body: "What are you grateful for right now? What ordinary moment felt good? Who made you feel supported? What did you almost overlook?" },
        { title: "Reflect on a hard day", body: "What felt heavy today? What are you carrying that can wait until tomorrow? What did you need but not receive? Where could you give yourself a little more grace?" },
        { title: "Look toward tomorrow", body: "What would make tomorrow feel gentler? What is one thing worth protecting time for? What can you simplify? What are you looking forward to?" },
        { title: "How Tranqly chooses prompts", body: "New users see varied questions that make it easy to begin. With enough history, Tranqly can softly reference a recent theme without assuming how you feel or forcing every prompt to revisit the past." },
      ]}
      faq={[
        { question: "What should I write in a daily reflection?", answer: "Start with one concrete moment, feeling, choice, or change from the day. A useful reflection can be one sentence. Specific details are often more helpful than trying to summarize everything." },
        { question: "How long should a daily reflection take?", answer: "There is no required length. Tranqly is designed around a reflection of up to 60 seconds, but shorter is fine when that is all you need." },
        { question: "What if I do not know what to write?", answer: "Choose the question that creates the easiest first sentence. You can also begin with: The part of today I keep thinking about is..." },
        { question: "Should I use the same prompt every day?", answer: "You can, but varied questions can help you notice different parts of your experience. Tranqly rotates prompts and can personalize them gently over time." },
      ]}
      related={linksWithout(path)}
    />
  );
}
