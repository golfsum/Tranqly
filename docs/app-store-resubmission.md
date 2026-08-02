# Tranqly App Store resubmission

## App Review notes

Tranqly Plus uses Apple in-app purchase through RevenueCat.

To test:

1. Complete or skip onboarding.
2. Open You.
3. Open the Tranqly Plus plan area.
4. Choose Monthly or Yearly.
5. Confirm that the localized App Store price and billing cycle are visible.
6. Tap Continue my Journey.
7. Complete the sandbox purchase.
8. Confirm that the Welcome to Tranqly Plus screen appears and Plus access is active.

The paywall includes:

- Subscription title, billing cycle, and localized App Store price.
- Auto-renewal and cancellation disclosure.
- Restore purchases.
- [Terms of Use (EULA)](https://tranqly.app/terms).
- [Privacy Policy](https://tranqly.app/privacy).

## App Store Connect checks

Complete these before resubmitting:

- The monthly and yearly subscriptions are in the same subscription group.
- Both products have pricing, localization, and review information.
- Both products are available for sale and included with the submitted app version.
- Paid Applications agreements, tax forms, and banking are active.
- The RevenueCat iOS app uses bundle ID `com.tranqly.app`.
- RevenueCat entitlement `plus` includes both App Store products.
- The RevenueCat default offering has a Monthly package and an Annual package.
- The production EAS build includes `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=plus`.
- App Store Connect Privacy Policy URL is `https://tranqly.app/privacy`.
- App Store Connect License Agreement or description links to `https://tranqly.app/terms`.

## Physical-device verification

Use a new build on a physical iPhone with a Sandbox Apple account:

1. Confirm both localized prices load without showing Unavailable.
2. Buy Monthly and confirm Plus unlocks without relaunching.
3. Sign out, sign back in, and confirm Plus remains active.
4. Restore purchases and confirm Plus unlocks.
5. Test Yearly with a separate sandbox account.
6. Confirm Terms of Use and Privacy Policy open from both paywalls.
7. Capture a screen recording for App Review if the original rejection included a purchase failure.
