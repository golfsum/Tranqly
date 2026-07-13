import { expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

type CoverageOptions = {
  overlap?: number;
  settleMs?: number;
};

export type CoverageResult = {
  clientHeight: number;
  contentHeight: number;
  frames: number;
  positions: number[];
};

function frameName(name: string, index: number, total: number) {
  if (total === 1) return `${name}-01-full.png`;
  const number = String(index + 1).padStart(2, "0");
  if (index === 0) return `${name}-${number}-top.png`;
  if (index === total - 1) return `${name}-${number}-bottom.png`;
  return `${name}-${number}.png`;
}

function removeStaleFrames(testInfo: TestInfo, name: string, expected: string[]) {
  if (testInfo.config.updateSnapshots === "none") return;

  const firstPath = testInfo.snapshotPath(expected[0]);
  const folder = dirname(firstPath);
  if (!existsSync(folder)) return;

  const keep = new Set(expected);
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const framePattern = new RegExp(`^${escapedName}-\\d{2}(?:-(?:full|top|bottom))?\\.png$`);
  for (const file of readdirSync(folder)) {
    const belongsToSequence = file === `${name}.png` || framePattern.test(file);
    if (belongsToSequence && file.endsWith(".png") && !keep.has(file)) {
      rmSync(join(folder, file));
    }
  }
}

/**
 * Captures a scroll container from its true top to its true bottom.
 * The frame count is calculated independently for each device from the
 * rendered clientHeight and scrollHeight. Adjacent frames overlap so no
 * content can land in an uncaptured gap.
 */
export async function captureScrollableCoverage(
  page: Page,
  scroller: Locator,
  name: string,
  testInfo: TestInfo,
  options: CoverageOptions = {},
): Promise<CoverageResult> {
  const overlap = options.overlap ?? 96;
  const settleMs = options.settleMs ?? 120;

  await expect(scroller).toBeVisible();
  const dimensions = await scroller.evaluate((element: HTMLElement) => ({
    clientHeight: element.clientHeight,
    contentHeight: element.scrollHeight,
  }));
  expect(dimensions.clientHeight, `${name} must have a visible height`).toBeGreaterThan(0);

  const maxScroll = Math.max(0, dimensions.contentHeight - dimensions.clientHeight);
  const step = Math.max(1, dimensions.clientHeight - Math.min(overlap, dimensions.clientHeight - 1));
  const positions = [0];
  for (let position = step; position < maxScroll; position += step) positions.push(position);
  if (maxScroll > 0) positions.push(maxScroll);

  const names = positions.map((_, index) => frameName(name, index, positions.length));
  removeStaleFrames(testInfo, name, names);

  for (let index = 0; index < positions.length; index += 1) {
    const requestedPosition = positions[index];
    const actualPosition = await scroller.evaluate((element: HTMLElement, top: number) => {
      element.scrollTop = top;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
      return element.scrollTop;
    }, requestedPosition);
    expect(Math.abs(actualPosition - requestedPosition), `${name} frame ${index + 1} scroll position`).toBeLessThanOrEqual(1);
    await page.waitForTimeout(settleMs);
    await expect(page).toHaveScreenshot(names[index], {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  }

  for (let index = 1; index < positions.length; index += 1) {
    expect(
      positions[index] - positions[index - 1],
      `${name} has an uncovered vertical gap`,
    ).toBeLessThanOrEqual(dimensions.clientHeight);
  }

  const finalPosition = await scroller.evaluate((element: HTMLElement) => element.scrollTop);
  expect(Math.abs(maxScroll - finalPosition), `${name} did not reach the true bottom`).toBeLessThanOrEqual(1);

  return {
    ...dimensions,
    frames: positions.length,
    positions,
  };
}
