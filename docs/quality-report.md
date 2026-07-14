# Tranqly Onboarding Quality Report

Updated: July 12, 2026

## Scope

- Unified web and mobile onboarding coordinator
- Responsive onboarding card shell
- App Store trial handoff
- Runtime-measured coach marks
- Skip, completion, persistence, and replay behavior

## Automated Verification

- Next.js production build: passed
- Expo TypeScript check: passed
- Expo iOS production export: passed
- Web onboarding tests: 2 passed across phone and desktop layouts
- Mobile onboarding tests: 10 passed across iPhone SE, iPhone 16 Pro, iPhone 16 Pro Max, Galaxy S24, and Galaxy A55 layouts
- Diff whitespace check: passed

## Verified Behavior

- The sequence is Welcome, Name, First Week, Trial, Reflection Coach, Journey Coach, Sanctuary Coach, Complete.
- Coach marks keep the user on Insights and point to measured interface targets.
- Skipping ends the whole sequence and prevents later coach marks.
- Replay begins at Welcome without relying on tab listeners.
- The name is optional and the trial screen contains no custom pricing.
- Trial enrollment is granted only after the configured App Store entitlement is returned.
- Small screens keep actions visible through a fixed card shell, scrollable content, and sticky actions.

## Remaining Native Checks

- Complete a sandbox purchase in an iOS development build. Expo Go cannot validate RevenueCat purchases.
- Verify the name-screen keyboard and Dynamic Type on a physical iPhone.
- Close Metro and run `npm install` in `apps/mobile` so the local `node_modules` copy of `expo-notifications` updates to the SDK 54 version already recorded in the manifest and lockfile.

## Release Gate

The onboarding implementation passes the repository's automated quality gate. App Store trial behavior remains blocked from final approval until the sandbox purchase succeeds in a development build.
