# Tranqly App Store screenshots

Refresh the real app captures from the current Expo build, then generate the 6.9-inch iPhone screenshot set:

```powershell
npm run screenshots:app-store:capture
npm run screenshots:app-store
```

Final exports are written to `app-store/6.9-inch/`. Every PNG is 1290 x 2796 pixels.

App Store order:

1. Notice What Matters
2. Reflect In One Minute
3. See Your Progress
4. Choose Your Sanctuary
5. Keep Reflections Private

The source captures in `source/` are rendered from the real Tranqly mobile app with deterministic store-demo data. Rerun both commands whenever the product UI changes.
