import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, '..', 'profile/icons');

const ICONS = {
  github: 'https://cdn.jsdelivr.net/npm/simple-icons@16.7.0/icons/github.svg',
  linkedin: 'https://cdn.jsdelivr.net/npm/simple-icons@3.0.1/icons/linkedin.svg',
  leetcode: 'https://cdn.jsdelivr.net/npm/simple-icons@16.7.0/icons/leetcode.svg',
  site: 'profile/dark-avatar-full.png',
};

// Card layout
const CARD_SIZE = 64; // viewBox 0 0 64 64
const PAD = 14; // icon padding inside card
const RX = 16; // corner radius
const STROKE = 2;
const FG = '#111111';
const BG = '#ffffff';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

function stripOuterSvg(svg) {
  // Remove XML header if any + extract the inner <svg ...>...</svg>
  const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!m) throw new Error('Invalid SVG');
  const inner = m[1];

  // Extract viewBox if present
  const vb = svg.match(/viewBox="([^"]+)"/i)?.[1] ?? '0 0 24 24';

  return { viewBox: vb, inner };
}

function wrapInCard({ title, viewBox, inner }) {
  const innerSize = CARD_SIZE - PAD * 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_SIZE}" height="${CARD_SIZE}" viewBox="0 0 ${CARD_SIZE} ${CARD_SIZE}" role="img" aria-label="${title}">
  <title>${title}</title>

  <rect x="${STROKE / 2}" y="${STROKE / 2}" width="${CARD_SIZE - STROKE}" height="${CARD_SIZE - STROKE}"
        rx="${RX}" fill="${BG}" stroke="${FG}" stroke-width="${STROKE}" />

  <svg x="${PAD}" y="${PAD}" width="${innerSize}" height="${innerSize}" viewBox="${viewBox}" fill="${FG}" xmlns="http://www.w3.org/2000/svg">
    ${inner}
  </svg>
</svg>`;
}

// Optional: a simple “website” icon (monogram) in same style
function websiteIconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_SIZE}" height="${CARD_SIZE}" viewBox="0 0 ${CARD_SIZE} ${CARD_SIZE}" role="img" aria-label="website">
  <title>website</title>
  <rect x="${STROKE / 2}" y="${STROKE / 2}" width="${CARD_SIZE - STROKE}" height="${CARD_SIZE - STROKE}"
        rx="${RX}" fill="${BG}" stroke="${FG}" stroke-width="${STROKE}" />
  <g fill="${FG}">
    <rect x="18" y="18" width="8" height="28" rx="4"/>
    <rect x="38" y="18" width="8" height="28" rx="4"/>
    <rect x="18" y="28" width="28" height="8" rx="4"/>
  </g>
</svg>`;
}

function guessMime(filePath) {
  // Minimal mime guessing (enough for png/svg).
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function fileToDataUri(absPath) {
  const buf = await fs.readFile(absPath);
  const mime = guessMime(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function wrapPngInCard({ title, dataUri }) {
  // Draw the same white rounded card with black stroke,
  // and place the image inside with a clipping rounded-rect.
  const innerSize = CARD_SIZE - PAD * 2;
  const innerRx = 10;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_SIZE}" height="${CARD_SIZE}" viewBox="0 0 ${CARD_SIZE} ${CARD_SIZE}" role="img" aria-label="${title}">
  <title>${title}</title>

  <defs>
    <clipPath id="clip">
      <rect x="${PAD}" y="${PAD}" width="${innerSize}" height="${innerSize}" rx="${innerRx}" />
    </clipPath>
  </defs>

  <rect x="${STROKE / 2}" y="${STROKE / 2}" width="${CARD_SIZE - STROKE}" height="${CARD_SIZE - STROKE}"
        rx="${RX}" fill="${BG}" stroke="${FG}" stroke-width="${STROKE}" />

  <image
    href="${dataUri}"
    x="${PAD}"
    y="${PAD}"
    width="${innerSize}"
    height="${innerSize}"
    preserveAspectRatio="xMidYMid slice"
    clip-path="url(#clip)"
  />
</svg>`;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const [name, src] of Object.entries(ICONS)) {
    // Handle local PNG/JPG/WEBP as a "site" icon.
    if (!src.startsWith('http')) {
      const absPath = path.resolve(__dirname, '..', src);
      const dataUri = await fileToDataUri(absPath);
      const wrapped = wrapPngInCard({ title: name, dataUri });
      await fs.writeFile(path.join(OUT_DIR, `${name}.svg`), wrapped, 'utf8');
      continue;
    }

    // Default: remote SVG (simple-icons).
    const raw = await fetchText(src);
    const { viewBox, inner } = stripOuterSvg(raw);
    const wrapped = wrapInCard({ title: name, viewBox, inner });
    await fs.writeFile(path.join(OUT_DIR, `${name}.svg`), wrapped, 'utf8');
  }

  console.log('Generated icons into', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
