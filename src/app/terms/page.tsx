import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | Tranqly",
  description: "Terms governing use of Tranqly, including AI reflection features, subscriptions, acceptable use, disclaimers, and limitations of liability.",
  alternates: { canonical: "/terms" },
};

const updated = "July 9, 2026";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={updated}
      intro="These Terms govern your access to and use of Tranqly. By using Tranqly, you agree to these Terms. If you do not agree, do not use the service."
    >
      <LegalSection title="1. Tranqly is not medical care">
        <p>
          Tranqly is a daily reflection and personal insight tool. It is not therapy, medical care, mental health treatment, crisis support, diagnosis, legal advice, financial advice, or any other professional service. AI responses may be incomplete, inaccurate, or inappropriate for your situation.
        </p>
        <p>
          If you are in danger, thinking about harming yourself or someone else, or experiencing a medical or mental health emergency, call emergency services or a crisis hotline immediately. Do not rely on Tranqly in an emergency.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility and accounts">
        <p>
          You must be at least 13 years old to use Tranqly. If you are under the age of majority where you live, you may use Tranqly only with permission from a parent or legal guardian. You are responsible for your account, devices, credentials, and all activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="3. Your content">
        <p>
          You keep ownership of reflections, recordings, notes, and other content you submit to Tranqly. You grant Tranqly a limited, worldwide, non-exclusive license to host, process, transmit, display, reproduce, modify, and create derived outputs from your content solely to operate, secure, support, improve, and provide Tranqly features to you.
        </p>
        <p>
          You are responsible for the content you submit and must have the rights needed to submit it. Do not submit content that is unlawful, abusive, invasive of another person&apos;s privacy, or infringes someone else&apos;s rights.
        </p>
      </LegalSection>

      <LegalSection title="4. AI-generated output">
        <p>
          Tranqly uses AI to generate prompts, summaries, tags, patterns, and reflective responses. AI output is generated automatically and may be wrong, generic, offensive, unsafe, or not useful. You are responsible for deciding whether and how to use any output.
        </p>
        <p>
          Tranqly does not guarantee that AI output will be accurate, complete, personalized, available, or suitable for your needs. You should not make important health, safety, legal, financial, employment, or relationship decisions based only on Tranqly output.
        </p>
      </LegalSection>

      <LegalSection title="5. Subscriptions, billing, and trials">
        <p>
          Tranqly may offer free and paid plans. Paid features may include unlimited AI insights, weekly pattern summaries, premium sanctuary themes, and more personalized guidance over time. Prices, features, and plan names may change, but changes will not affect the current term you already paid for unless permitted by the applicable app store or payment provider rules.
        </p>
        <p>
          Mobile subscriptions may be purchased through Apple or another app store and are governed by that store&apos;s billing, cancellation, and refund rules. For subscriptions purchased through Apple, payment is charged to your Apple ID when you confirm the purchase. The subscription automatically renews unless you cancel it at least 24 hours before the end of the current billing period. Your Apple ID account will be charged for renewal within 24 hours before the current period ends. You can manage or cancel the subscription in your App Store account settings.
        </p>
        <p>
          Web purchases may be processed by a payment provider such as Stripe. You are responsible for managing cancellations before renewal. Except where required by law or app store policy, fees are non-refundable. Canceling stops future renewals but does not remove access already paid for during the current billing period.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Use Tranqly for emergencies, crisis response, medical treatment, diagnosis, or professional advice.</li>
          <li>Reverse engineer, scrape, overload, attack, or interfere with Tranqly or its providers.</li>
          <li>Use Tranqly to create harmful, illegal, abusive, harassing, deceptive, or infringing content.</li>
          <li>Attempt to bypass usage limits, subscription controls, security controls, or access restrictions.</li>
          <li>Upload malware, credentials, payment card numbers, government identifiers, or content you do not have permission to use.</li>
          <li>Use Tranqly in a way that violates applicable law or another person&apos;s rights.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Availability and changes">
        <p>
          Tranqly may change, suspend, limit, or discontinue features at any time. We may update AI models, pricing, limits, sanctuary themes, prompts, and app design. We do not guarantee uninterrupted availability, data sync, transcription accuracy, AI quality, or that any feature will remain available forever.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-party services">
        <p>
          Tranqly depends on third-party services for hosting, authentication, storage, AI, transcription, payments, app distribution, notifications, email, and analytics. We are not responsible for third-party services, outages, terms, policies, or actions. Your use of app stores and payment processors may be subject to their separate terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Intellectual property">
        <p>
          Tranqly, including its software, design, branding, logos, artwork, sanctuary concepts, interfaces, and content other than your submitted content, is owned by Tranqly or its licensors and is protected by intellectual property laws. You may not copy, modify, distribute, sell, or create derivative works from Tranqly except as allowed by these Terms or with written permission.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          You may stop using Tranqly at any time. We may suspend or terminate access if we believe you violated these Terms, create risk, misuse the service, fail to pay, or if required by law. After termination, sections that by their nature should survive will survive, including ownership, disclaimers, limitations of liability, indemnity, and dispute provisions.
        </p>
      </LegalSection>

      <LegalSection title="11. Disclaimers">
        <p>
          To the fullest extent permitted by law, Tranqly is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, title, non-infringement, availability, accuracy, reliability, or security.
        </p>
      </LegalSection>

      <LegalSection title="12. Limitation of liability">
        <p>
          To the fullest extent permitted by law, Tranqly and its owners, officers, employees, contractors, affiliates, and providers will not be liable for indirect, incidental, special, consequential, exemplary, punitive, or lost-profit damages, or for loss of data, goodwill, use, or business, even if advised of the possibility of such damages.
        </p>
        <p>
          To the fullest extent permitted by law, Tranqly&apos;s total liability for all claims relating to the service will be limited to the greater of the amount you paid to Tranqly for the service in the three months before the claim or $100.
        </p>
      </LegalSection>

      <LegalSection title="13. Indemnity">
        <p>
          To the fullest extent permitted by law, you agree to defend, indemnify, and hold harmless Tranqly and its owners, officers, employees, contractors, affiliates, and providers from claims, damages, losses, liabilities, costs, and expenses, including reasonable attorneys&apos; fees, arising from your content, your use of Tranqly, your violation of these Terms, or your violation of law or third-party rights.
        </p>
      </LegalSection>

      <LegalSection title="14. Disputes and governing law">
        <p>
          These Terms are governed by the laws of the State of Arizona, excluding conflict-of-law rules, unless applicable law requires otherwise. Before filing a claim, you agree to email{" "}
          <a className="font-bold text-[#d2a9ff]" href="mailto:support@tranqly.com">support@tranqly.com</a>{" "}
          and try to resolve the dispute informally for at least 30 days.
        </p>
        <p>
          To the fullest extent permitted by law, disputes must be brought individually and not as a class, consolidated, private attorney general, or representative action. Some jurisdictions do not allow certain dispute limits, so parts of this section may not apply to you.
        </p>
      </LegalSection>

      <LegalSection title="15. App store terms">
        <p>
          If you download Tranqly from Apple&apos;s App Store or another app store, the app store provider is not responsible for Tranqly, support, claims, or content except as required by its own terms. App store terms may apply in addition to these Terms.
        </p>
      </LegalSection>

      <LegalSection title="16. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If changes are material, we will provide reasonable notice. Your continued use of Tranqly after updated Terms become effective means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="17. Contact">
        <p>
          Email: <a className="font-bold text-[#d2a9ff]" href="mailto:support@tranqly.com">support@tranqly.com</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
