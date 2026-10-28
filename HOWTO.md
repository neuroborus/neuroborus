## Metrics Generator — HOWTO

### What this is
This repo contains a GitHub Actions workflow and dependency-free Node.js scripts that generate profile assets:
- A monochrome SVG chart of top programming languages across all repositories for the GitHub user `neuroborus`.
- A set of monochrome social icon cards (GitHub, LinkedIn, LeetCode, site).
Outputs are deterministic; the workflow commits the metrics chart only when it actually changes.

### How it works
- The workflow runs daily at 00:00 UTC (and can be started manually).
- It runs `scripts/generate-metrics.mjs`.
- The metrics script:
  - Fetches all repos for `neuroborus` via the GitHub API.
  - Skips forks and archived repos.
  - Aggregates language byte counts from `/languages` per repo.
  - Sorts by bytes (desc), then name (asc), and keeps top 10.
  - Renders `profile/metrics/languages.svg` in monochrome with deterministic layout.
- The workflow commits and pushes only if `git diff --quiet` detects changes.
- The social icons script `scripts/generate-social-icons.mjs` is not part of the workflow; run it manually when icons change:
  - Pulls SVGs from Simple Icons (and wraps a local PNG for the site icon).
  - Renders square monochrome cards to `profile/icons/*.svg`.

### Requirements
- GitHub Actions:
  - `GITHUB_TOKEN` (provided automatically by GitHub Actions).
  - Workflow permission: `contents: write` to allow commits.
- Local usage (optional):
  - Node.js 24+.
  - A GitHub token with repo read access set in `GITHUB_TOKEN` (metrics script only).
  - Network access to `cdn.jsdelivr.net` for icon sources.

### Run locally
```bash
export GITHUB_TOKEN=YOUR_TOKEN
node scripts/generate-metrics.mjs
```

### Run example
```bash
export GITHUB_TOKEN=ghp_exampletoken123
node scripts/generate-metrics.mjs
ls -la profile/metrics/languages.svg
```

### Run social icons generator
Not run by CI and needs no token; commit the regenerated icons yourself.
```bash
node scripts/generate-social-icons.mjs
ls -la profile/icons/*.svg
```

### Where the output lives
- `profile/metrics/languages.svg`
- `profile/icons/*.svg`
- Embedded in `README.md` as:
  - `![Languages](./profile/metrics/languages.svg)`

### Change detection
The workflow uses `git diff --quiet` after generation:
- No diff → exits successfully with no commit.
- Diff found → `git add profile/metrics/languages.svg`, `git commit`, `git push`.

### Notes
- The SVG is deterministic (no timestamps/random IDs).
- Only monochrome colors are used (white background, near-black bars, text and border).
