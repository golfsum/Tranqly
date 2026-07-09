# Tranqly

A calming, motivational daily coaching app. Every evening you answer one question, **"What did you do today?"**, by voice or text. A kind AI coach responds with warm, non-judgmental encouragement and one gentle next step.

This repo now has two targets:

- `src/`: Next.js web app and backend API routes.
- `apps/mobile/`: native Expo app for EAS builds and App Store submission.

## Quick Start

```powershell
npm install
npm --prefix apps/mobile install
npm run icons
npm run dev
```

The app is functional with zero configuration. Reflections, moods, and streaks persist to the device, and a built-in local coach responds warmly. Env keys progressively unlock cloud features:

| Feature | Needs | Without it |
|---|---|---|
| AI coach replies and voice transcription | `GROQ_API_KEY` | Built-in local coach, text input still works |
| Google sign-in and Firestore sync | `NEXT_PUBLIC_FIREBASE_*` | Local-only mode |
| Real Stripe checkout | `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` | Demo upgrade with instant unlock |

Copy `.env.local.example` to `.env.local` and fill in what you have.

## AI Setup

Groq powers both text coaching and voice transcription:

```env
GROQ_API_KEY=
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

The server routes fall back gracefully when `GROQ_API_KEY` is missing.

## Native iOS App

The Expo app lives in `apps/mobile` and is configured for EAS.

```powershell
npm --prefix apps/mobile install
npm run mobile:start
npm run mobile:typecheck
```

Before an App Store build, deploy the Next backend somewhere public, usually Vercel, and point the mobile app at it:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="https://your-tranqly-backend.vercel.app"
npm run mobile:build:ios
npm run mobile:submit:ios
```

Do not put `GROQ_API_KEY` in the Expo app. Keep it on the deployed backend so the key is not exposed inside the iOS binary.

Update `apps/mobile/app.json` before submission:

- Change `ios.bundleIdentifier` from `com.tranqly.app` if you want a different bundle id.
- Confirm the App Store display name is `Tranqly`.
- Replace the icon and splash assets if you want final production artwork.

## The Coach Voice

The coach is prompted to be warm, plainspoken, specific, and human. It avoids em dashes, headers, bullet points, guilt, and criticism. Replies are schema-constrained so the UI can reliably render the feedback bubble, next step, and learned memory note.

## Monetization

- Free: 3 coach replies per day. The reflection itself is never blocked.
- Premium: unlimited coaching, premium themes, and deeper weekly insights.
- Checkout runs through Stripe at `/api/checkout`, with an entitlement webhook skeleton at `/api/stripe-webhook`.

## Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable Google sign-in under Authentication.
3. Add your Vercel domain under Authentication authorized domains.
4. Create a Firestore database.
5. Copy your web app config into `.env.local`.

## Voice Input

The mic records audio in the browser with `MediaRecorder`, sends it to `/api/transcribe`, and Groq transcribes it with `whisper-large-v3-turbo` by default. If the browser cannot record audio or the API key is missing, the textarea still works.
