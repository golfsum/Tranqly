/**
 * Generates PWA icons (192, 512, apple-touch 180) as PNGs with zero
 * image-library dependencies, a rounded-square lavender to teal gradient
 * with a soft white heart. Run: npm run icons
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// ---- minimal PNG encoder -------------------------------------------------
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function encodePng(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- icon artwork ---------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;

// distance from point to segment, in unit space
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function iconPixel(x, y, size) {
  const u = x / size, v = y / size;

  // rounded-rect mask (iOS squircle-ish, radius 22%)
  const r = 0.22;
  const cx = Math.min(Math.max(u, r), 1 - r);
  const cy = Math.min(Math.max(v, r), 1 - r);
  const cornerDist = Math.hypot(u - cx, v - cy);
  const aa = 1.5 / size;
  const mask = Math.max(0, Math.min(1, (r - cornerDist) / aa + 0.5));
  if (mask <= 0) return [0, 0, 0, 0];

  // diagonal lavender to teal gradient (#A78BFA to #5EEAD4)
  const t = (u + v) / 2;
  let R = lerp(0xa7, 0x5e, t);
  let G = lerp(0x8b, 0xea, t);
  let B = lerp(0xfa, 0xd4, t);

  // soft radial highlight upper-left
  const glow = Math.max(0, 1 - Math.hypot(u - 0.3, v - 0.25) * 2.2) * 0.22;
  R = Math.min(255, R + glow * 255);
  G = Math.min(255, G + glow * 255);
  B = Math.min(255, B + glow * 255);

  // white heart: two circles + a diamond (point-down)
  const inHeart =
    Math.hypot(u - 0.385, v - 0.42) < 0.15 ||
    Math.hypot(u - 0.615, v - 0.42) < 0.15 ||
    Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.265;
  // approximate anti-aliasing via a slightly larger soft edge
  const nearHeart =
    Math.hypot(u - 0.385, v - 0.42) < 0.15 + aa * 2 ||
    Math.hypot(u - 0.615, v - 0.42) < 0.15 + aa * 2 ||
    Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.265 + aa * 2;
  const heart = inHeart ? 1 : nearHeart ? 0.5 : 0;
  R = lerp(R, 255, heart);
  G = lerp(G, 255, heart);
  B = lerp(B, 255, heart);

  return [Math.round(R), Math.round(G), Math.round(B), Math.round(mask * 255)];
}

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(join(outDir, name), encodePng(size, iconPixel));
  console.log(`✓ ${name} (${size}x${size})`);
}
