import SeoPage from "@/components/SeoPage";
import { linksWithout, seoMetadata } from "@/lib/seoPages";

const path = "/voice-journal";

export const metadata = seoMetadata(
  "60-Second Voice Journal for Daily Reflection | Tranqly",
  "Speak naturally for up to 60 seconds. Tranqly transcribes your reflection, saves the text, and creates a thoughtful AI insight from what you shared.",
  path,
);

export default function VoiceJournalPage() {
  return (
    <SeoPage
      path={path}
      eyebrow="60-second voice journal"
      title="Say what happened before you"
      accent="overthink it."
      intro="Tap the microphone, speak naturally, and let Tranqly turn your words into a reflection you can revisit. Voice makes it easier to capture the day when typing feels like work."
      image="/coming-soon/insights.jpeg"
      imageAlt="Tranqly voice journal with a 60-second microphone timer"
      proof={["Up to 60 seconds", "Review the transcript", "Type instead anytime"]}
      sections={[
        { title: "Tap and talk", body: "Use the daily prompt or simply say what is on your mind. A visible 60-second timer keeps the check-in focused without rushing you." },
        { title: "Review your words", body: "Tranqly transcribes the recording and places the text in your reflection field. You can correct it, add context, or remove anything before requesting an insight." },
        { title: "Keep the reflection", body: "The final transcript becomes part of your private reflection history, alongside the response and themes generated from it." },
        { title: "Why a short voice note works", body: "Speaking can preserve the details and natural language that disappear when you try to write a polished entry. The goal is not performance. It is capturing one honest moment while it is still clear." },
          { title: "Voice remains optional", body: "You can type every reflection instead. Tranqly should fit the moment you are in, including quiet spaces where recording is not practical." },
      ]}
      faq={[
        { question: "How long can a Tranqly voice reflection be?", answer: "Each voice session is limited to 60 seconds. You can add more context afterward by typing or continuing the conversation." },
        { question: "Can I edit the transcription?", answer: "Yes. The transcript appears as editable text before you request your insight." },
        { question: "Does Tranqly keep the raw audio?", answer: "Audio is processed as needed for transcription. Tranqly aims not to retain the raw recording longer than needed for that request unless a feature clearly states otherwise." },
        { question: "What if transcription fails?", answer: "Your app should show a clear status and let you retry. You can always type the reflection instead." },
      ]}
      related={linksWithout(path)}
    />
  );
}
