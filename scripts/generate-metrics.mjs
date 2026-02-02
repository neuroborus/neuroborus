import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const USERNAME = "neuroborus";
const TOP_N = 10;
const API_BASE = "https://api.github.com";
const OUTPUT_PATH = "profile/metrics/languages.svg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("GITHUB_TOKEN is required to fetch GitHub API data.");
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "metrics-generator",
};

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status} for ${url}: ${body}`);
  }
  return res.json();
}

async function fetchAllRepos(username) {
  const repos = [];
  let page = 1;
  while (true) {
    const url = `${API_BASE}/users/${username}/repos?per_page=100&page=${page}`;
    const chunk = await fetchJson(url);
    if (!Array.isArray(chunk) || chunk.length === 0) {
      break;
    }
    repos.push(...chunk);
    page += 1;
  }
  return repos;
}

async function fetchLanguages(owner, repo) {
  const url = `${API_BASE}/repos/${owner}/${repo}/languages`;
  return fetchJson(url);
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderSvg(entries) {
  const width = 800;

  // Layout
  const paddingX = 28;          // symmetric => centered content
  const headerHeight = 72;      // more space above + between title and bars
  const footerHeight = 52;      // space for watermark
  const barHeight = 18;
  const gapY = 12;

  // Columns inside the content area
  const maxLabelLen = Math.max(0, ...entries.map(e => e.name.length));
  const labelColWidth = Math.min(160, Math.max(110, maxLabelLen * 7)); // ~7px per char
  const percentColWidth = 90;   // space for "100.00%"
  const gapX = 16;              // space between columns

  const chartHeight = entries.length * barHeight + Math.max(0, entries.length - 1) * gapY;
  const height = headerHeight + chartHeight + footerHeight;

  const contentWidth = width - paddingX * 2;
  const barMaxWidth =
      contentWidth - labelColWidth - percentColWidth - gapX * 2;

  const labelTextX = paddingX + labelColWidth - 12;                 // text-anchor="end"
  const barX = paddingX + labelColWidth + gapX;
  const percentTextX = paddingX + labelColWidth + gapX + barMaxWidth + percentColWidth; // text-anchor="end"

  const maxBytes = Math.max(1, ...entries.map((e) => e.bytes));
  const totalBytes = Math.max(1, entries.reduce((sum, e) => sum + e.bytes, 0));

  const bars = entries
      .map((entry, index) => {
        const y = headerHeight + index * (barHeight + gapY);
        const barWidth = Math.round((entry.bytes / maxBytes) * barMaxWidth * 100) / 100;
        const percent = Math.round((entry.bytes / totalBytes) * 10000) / 100;

        return `
    <g>
      <text x="${labelTextX}" y="${y + barHeight - 4}" text-anchor="end">${escapeXml(entry.name)}</text>
      <rect class="bar" x="${barX}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" />
      <text x="${percentTextX}" y="${y + barHeight - 4}" text-anchor="end">${percent.toFixed(2)}%</text>
    </g>`;
      })
      .join("");

  const titleY = 40; // inside header area (more breathing room)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top languages">
  <rect class="card" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="18" />

  <style>
    text { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 12px; fill: #111111; }
    .card { fill: #ffffff; stroke: #111111; stroke-width: 2; }
    .bar { fill: #111111; }
    .watermark { fill: #111111; opacity: 0.28; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; }
  </style>

  <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-size="14px" font-weight="600">Top Languages</text>

  ${bars}

  <text class="watermark" x="${width / 2}" y="${height - 18}" text-anchor="middle">hasso.tech</text>
</svg>`;
}

async function main() {
  const repos = await fetchAllRepos(USERNAME);
  const filtered = repos.filter((repo) => !repo.fork && !repo.archived);

  const totals = new Map();
  for (const repo of filtered) {
    const languages = await fetchLanguages(repo.owner.login, repo.name);
    for (const [name, bytes] of Object.entries(languages)) {
      totals.set(name, (totals.get(name) ?? 0) + bytes);
    }
  }

  const entries = Array.from(totals.entries())
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => (b.bytes - a.bytes) || a.name.localeCompare(b.name))
    .slice(0, TOP_N);

  const svg = renderSvg(entries);
  const outputPath = path.resolve(__dirname, "..", OUTPUT_PATH);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, svg, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
