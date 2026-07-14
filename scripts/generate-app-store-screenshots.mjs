import { chromium } from "playwright";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "apps", "mobile", "store-assets", "source");
const outputDir = path.join(root, "apps", "mobile", "store-assets", "app-store", "6.9-inch");
const logoPath = path.join(root, "apps", "mobile", "assets", "images", "tranqly_logo.png");

const shots = [
  {
    output: "01-notice-what-matters.png",
    source: "02-personal-insight-current.png",
    title: "Notice What Matters",
    background: ["#f0e8ff", "#cdb9ff"],
    ink: "#241735",
    accent: "#7142c8",
    zoom: 1.12,
    focusY: 55,
    shiftY: 0,
  },
  {
    output: "02-reflect-in-one-minute.png",
    source: "01-insights-current.png",
    title: "Reflect In One Minute",
    background: ["#ffeaf4", "#e8b7d4"],
    ink: "#331a2c",
    accent: "#a13e7c",
    zoom: 1.08,
    focusY: 30,
    shiftY: 0,
  },
  {
    output: "03-see-your-progress.png",
    source: "03-first-week-current.png",
    title: "See Your Progress",
    background: ["#e1f8f2", "#a7ddd3"],
    ink: "#17352f",
    accent: "#247e70",
    zoom: 1.04,
    focusY: 26,
    shiftY: 0,
  },
  {
    output: "04-choose-your-sanctuary.png",
    source: "06-themes-current.png",
    title: "Choose Your Sanctuary",
    background: ["#fff0dd", "#f0bd91"],
    ink: "#3a251b",
    accent: "#b35f35",
    zoom: 1.11,
    focusY: 48,
    shiftY: 0,
  },
  {
    output: "05-keep-reflections-private.png",
    source: "07-privacy-current.png",
    title: "Keep Reflections Private",
    background: ["#e8f1ff", "#b5c9ee"],
    ink: "#17243a",
    accent: "#486b9f",
    zoom: 1,
    focusY: 100,
    shiftY: 0,
  },
];

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function dataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const bytes = await readFile(filePath);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function pageHtml({ shot, screenUri, logoUri }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1290px; height: 2796px; overflow: hidden; }
    body {
      color: #fffaf7;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      background: #090713;
      -webkit-font-smoothing: antialiased;
    }
    .canvas {
      position: relative;
      width: 1290px;
      height: 2796px;
      overflow: hidden;
      background: linear-gradient(155deg, ${shot.background[0]} 0%, ${shot.background[1]} 100%);
    }
    .shade {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 12% 15%, rgba(255,255,255,.78) 0, transparent 25%),
        radial-gradient(circle at 88% 42%, rgba(255,255,255,.38) 0, transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.02) 55%, rgba(24,14,38,.08) 100%);
    }
    .orb {
      position: absolute;
      width: 760px;
      height: 760px;
      right: -360px;
      top: 430px;
      border: 2px solid rgba(255,255,255,.32);
      border-radius: 50%;
    }
    .content {
      position: relative;
      z-index: 3;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 76px 72px 0;
    }
    .brand {
      display: flex;
      align-items: center;
      align-self: flex-start;
      gap: 18px;
      color: ${shot.ink};
      font-size: 35px;
      font-weight: 800;
      letter-spacing: -.5px;
    }
    .brand img {
      width: 58px;
      height: 58px;
      object-fit: contain;
      filter: drop-shadow(0 0 18px rgba(87,52,145,.28));
    }
    .copy {
      width: 100%;
      margin-top: 68px;
      text-align: center;
    }
    h1 {
      max-width: 1080px;
      margin: 0 auto;
      color: ${shot.ink};
      font-size: 118px;
      line-height: .98;
      letter-spacing: -6.2px;
      font-weight: 900;
      text-wrap: balance;
      text-shadow: 0 4px 18px rgba(255,255,255,.18);
    }
    .phone {
      position: absolute;
      left: 50%;
      bottom: -40px;
      width: 962px;
      padding: 17px;
      border-radius: 110px 110px 0 0;
      transform: translateX(-50%);
      background: linear-gradient(145deg, #403d4a 0%, #0b0a10 17%, #000 78%, #26232d 100%);
      box-shadow: 0 42px 130px rgba(0,0,0,.66), 0 0 90px ${shot.accent}2a;
    }
    .screen {
      position: relative;
      width: 928px;
      height: 2018px;
      overflow: hidden;
      border-radius: 92px 92px 0 0;
      background: #05040a;
      border: 2px solid rgba(255,255,255,.13);
    }
    .screen img {
      position: absolute;
      top: 78px;
      left: 0;
      width: 100%;
      height: calc(100% - 78px);
      display: block;
      object-fit: cover;
      object-position: center top;
      transform: translateY(${shot.shiftY}px) scale(${shot.zoom});
      transform-origin: 50% ${shot.focusY}%;
    }
    .status {
      position: absolute;
      z-index: 5;
      top: 0;
      left: 0;
      right: 0;
      height: 78px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 62px;
      color: #fff;
      background: #05040a;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: .2px;
    }
    .status-icons {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .status-icons svg { display: block; fill: none; stroke: #fff; stroke-width: 2.4; stroke-linecap: round; }
    .signal-icon { width: 31px; height: 24px; }
    .wifi-icon { width: 30px; height: 24px; }
    .battery {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 48px;
      height: 27px;
      padding: 0 6px;
      border-radius: 7px;
      color: #08070c;
      background: #fff;
      font-size: 17px;
      font-weight: 900;
    }
    .island {
      position: absolute;
      z-index: 4;
      top: 22px;
      left: 50%;
      width: 225px;
      height: 62px;
      transform: translateX(-50%);
      border-radius: 42px;
      background: #020204;
      box-shadow: 0 2px 2px rgba(255,255,255,.08) inset;
    }
  </style>
</head>
<body>
  <main class="canvas">
    <div class="shade"></div>
    <div class="orb"></div>
    <div class="content">
      <div class="brand"><img src="${logoUri}" alt="" /><span>Tranqly</span></div>
      <section class="copy">
        <h1>${escapeHtml(shot.title)}</h1>
      </section>
      <div class="phone">
        <div class="screen">
          <div class="status">
            <span>9:41</span>
            <span class="status-icons">
              <svg class="signal-icon" viewBox="0 0 32 24" aria-hidden="true">
                <path d="M3 21v-3M10 21v-7M17 21V9M24 21V5" />
              </svg>
              <svg class="wifi-icon" viewBox="0 0 32 24" aria-hidden="true">
                <path d="M3 8.5C10.2 2.2 21.8 2.2 29 8.5M8 13c4.5-3.8 11.5-3.8 16 0M13.1 17.5c1.7-1.4 4.1-1.4 5.8 0" />
                <path d="M16 21h.01" />
              </svg>
              <span class="battery">88</span>
            </span>
          </div>
          <div class="island"></div>
          <img src="${screenUri}" alt="" />
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

await mkdir(outputDir, { recursive: true });
for (const name of await readdir(outputDir)) {
  if (name.endsWith(".png") || name === "manifest.json") {
    await unlink(path.join(outputDir, name));
  }
}
const logoUri = await dataUri(logoPath);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });

try {
  for (const shot of shots) {
    const screenUri = await dataUri(path.join(sourceDir, shot.source));
    await page.setContent(pageHtml({ shot, screenUri, logoUri }), { waitUntil: "load" });
    await page.screenshot({ path: path.join(outputDir, shot.output), type: "png" });
  }

  await writeFile(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        size: { width: 1290, height: 2796 },
        generatedAt: new Date().toISOString(),
        screenshots: shots.map(({ output, title, source }) => ({
          output,
          source,
          title,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

console.log(`Generated ${shots.length} App Store screenshots in ${outputDir}`);
