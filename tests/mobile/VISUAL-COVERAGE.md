# Visual coverage

The mobile screenshot test does not use a fixed number of screenshots.

For every device and every scrollable screen it measures:

- the rendered viewport height
- the rendered content height
- the true maximum scroll position

It then captures overlapping frames from the exact top through the exact bottom. A short phone therefore creates more baselines than a tall phone. The test fails if a frame leaves a vertical gap or if the final frame does not reach the bottom.

## Adding another app

1. Give every primary scroll container a stable `testID`.
2. List every route, tab, modal, drawer, and important UI state in that app's visual-map spec.
3. Navigate to the state using roles or `testID`, then call `captureScrollableCoverage` from `support/visual-coverage.ts`.
4. Keep each app in its own test directory and snapshot path. Keep OS and device in the snapshot path.

The scroll helper can prove that all vertical content in a listed state was captured. It cannot safely guess every meaningful app state by clicking arbitrary buttons. The visual map is the explicit coverage contract for each app.

Update intentional baselines with:

```powershell
npm run test:visual:app:update
```

Verify existing baselines with:

```powershell
npm run test:app
```
