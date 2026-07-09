import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Tranqly",
  description: "How Tranqly collects, uses, protects, and deletes personal information for daily reflection, AI insights, sanctuaries, notifications, and account features.",
  alternates: { canonical: "/privacy" },
};

const updated = "July 9, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={updated}
      intro="Tranqly is a private daily reflection companion. This policy explains what we collect, why we collect it, how we use service providers, and what choices you have."
    >
      <LegalSection title="1. Who we are">
        <p>
          Tranqly provides mobile and web tools for daily reflection, voice or text check-ins, AI-generated insights, sanctuary themes, reminders, and related account features. If you have questions, contact us at{" "}
          <a className="font-bold text-[#d2a9ff]" href="mailto:support@tranqly.com">support@tranqly.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>We collect information you provide directly, information created when you use Tranqly, and limited technical information needed to operate the service.</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Account information, such as your email address, authentication provider, optional display name, subscription status, and settings.</li>
          <li>Reflection content, including text you type, transcribed voice reflections, prompts answered, AI summaries, tags, themes, and feedback you provide on responses.</li>
          <li>Voice recordings only as needed to transcribe your reflection. We do not use voice recordings to identify you. We aim to process audio for transcription and not keep raw audio longer than needed for that request unless a feature clearly says otherwise.</li>
          <li>App activity, such as check-in dates, streak counts, selected sanctuary theme, unlocked sanctuaries, notification preferences, onboarding status, and support tickets.</li>
          <li>Payment and subscription information. Payment card details are processed by payment providers and app stores. We do not store full credit card numbers.</li>
          <li>Waitlist and marketing information, such as your email address if you ask to be notified about launch or early access.</li>
          <li>Technical information, such as device type, browser, operating system, app version, IP-derived approximate location, API request metadata, diagnostics, crash/error logs, and performance logs.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <ul className="list-disc space-y-2 pl-6">
          <li>Provide daily reflections, voice transcription, AI insights, prompts, pattern summaries, sanctuary progression, and account sync.</li>
          <li>Personalize Tranqly, including greetings, prompt suggestions, patterns, theme unlocks, reminders, and long-term memory features.</li>
          <li>Process subscriptions, purchases, refunds, and billing support.</li>
          <li>Send service messages, notification reminders you enable, waitlist updates, and support replies.</li>
          <li>Detect, prevent, and investigate abuse, security issues, fraud, outages, and technical problems.</li>
          <li>Improve product quality, reliability, safety, and user experience using aggregated, de-identified, or privacy-protective analytics where practical.</li>
          <li>Comply with legal obligations and enforce our Terms.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. AI and transcription providers">
        <p>
          Tranqly uses third-party AI and infrastructure providers to generate insights and transcribe audio. Reflection text and audio may be sent to these providers only as needed to provide the requested feature, improve safety, troubleshoot failures, or comply with law. We instruct providers not to use your personal reflection content to train their general models unless a provider contract or setting expressly permits it and we have enabled that use.
        </p>
        <p>
          AI responses can be imperfect. Tranqly is not a medical, therapy, crisis, legal, financial, or professional advice service. Do not use Tranqly for emergencies.
        </p>
      </LegalSection>

      <LegalSection title="5. When we share information">
        <p>We do not sell your reflection content. We may share information with:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Service providers that host the app, store data, authenticate accounts, process payments, send notifications, transcribe audio, generate AI responses, provide analytics, or support operations.</li>
          <li>App stores and payment processors for subscription purchases and billing management.</li>
          <li>Law enforcement, courts, regulators, or other parties when we believe disclosure is required by law or needed to protect rights, safety, security, or prevent fraud or abuse.</li>
          <li>A successor organization if Tranqly is involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of assets, subject to appropriate confidentiality protections.</li>
          <li>Other people only if you intentionally share or export your own reflections.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Your choices and controls">
        <ul className="list-disc space-y-2 pl-6">
          <li>You can edit or clear your display name.</li>
          <li>You can turn reminders and notifications on or off in settings or through your device settings.</li>
          <li>You can request access, correction, export, or deletion of your personal information by contacting support.</li>
          <li>You can delete reflections or reset Tranqly memory where the app provides those controls.</li>
          <li>You can unsubscribe from marketing emails using the unsubscribe link or by contacting us.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          We keep personal information for as long as needed to provide Tranqly, maintain your account, comply with law, resolve disputes, enforce agreements, prevent abuse, and keep appropriate business records. If you delete your account or request deletion, we will delete or de-identify personal information unless we need to keep limited records for legal, security, billing, or fraud-prevention reasons.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use reasonable administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is completely secure. You are responsible for keeping your account credentials and devices secure.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          Tranqly is not intended for children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child provided personal information, contact us and we will take appropriate steps to delete it.
        </p>
      </LegalSection>

      <LegalSection title="10. U.S. state privacy rights">
        <p>
          Depending on where you live, you may have rights to know, access, correct, delete, port, or limit certain uses of personal information. You may also have the right to opt out of certain targeted advertising, sale, or sharing. Tranqly does not sell your reflection content. To exercise rights, contact{" "}
          <a className="font-bold text-[#d2a9ff]" href="mailto:support@tranqly.com">support@tranqly.com</a>. We may need to verify your request.
        </p>
      </LegalSection>

      <LegalSection title="11. International users">
        <p>
          Tranqly is operated from the United States. If you use Tranqly from outside the United States, your information may be processed in the United States or other countries where our providers operate, which may have different data protection laws than your location.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. If changes are material, we will provide notice through the app, website, email, or other reasonable means. The updated date above shows when this policy was last changed.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Email: <a className="font-bold text-[#d2a9ff]" href="mailto:support@tranqly.com">support@tranqly.com</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
