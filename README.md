# MAZZARI No. 1 — Mazzagotte Instrument Company

A personal airport-inspired split-flap smart display built with Next.js, React, TypeScript, and CSS 3D animations. It shows a local clock, weather, and sports scores/schedules on an adaptive board of up to 24 columns, plus optional personal messages.

Full feature descriptions, settings and behavior notes are in [docs/FEATURES.md](docs/FEATURES.md).

## Quick start

Requires **Node.js 20.9 or later** (tests need 22.6+).

```powershell
npm install
npm run dev
```

Open **http://localhost:1000**, then use **SETTINGS** to choose your city, leagues and favorite teams.

### Windows launchers

- `start-display.bat` checks Node.js, installs dependencies, builds the production app only when the source changed, starts a lightweight standalone server and opens your browser. Keep the server window open; close it to stop the display.
- `start-kiosk.bat` does the same and opens Chrome in kiosk mode with a separate profile (`Alt+F4` to exit). Configure settings once in that profile, or use Backup & Restore. Chrome restarts itself nightly at 4:00 to keep memory low; keep the launcher window open, and change or disable this with `-RestartHour <0-23>` / `-RestartHour -1`.
- Add `-NoBrowser` to start only the server. To start at sign-in, put a shortcut in `shell:startup`.
- If you previously ran `npm run dev`, stop it first so the launcher can start the production server on port 1000.

## Scripts

| Command                                 | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                           | Development server on port 1000                            |
| `npm run build` / `npm start`           | Production build and server (`.next-production`)          |
| `npm run typecheck`                     | TypeScript check                                           |
| `npm run lint`                          | ESLint                                                     |
| `npm run format` / `npm run format:check` | Prettier                                                 |
| `npm test`                              | Unit tests (Node's built-in runner)                        |
| `npm run build:worker` / `check:worker` | Cloudflare Worker build and dry-run deploy                 |

## Deployment

- **Next.js 16.4.2+** is required by the OpenNext adapter; run `npm ci` after updating and do not bypass its version check.
- **Drawing board and gesture cards:** draw on a 32×20 grid or start from a template, save up to 20 cards, rotate them, and schedule one-time surprises. See Settings > Draw a gesture.
- **Primary: local Node server** via the Windows launchers above. This is the supported way to run a dedicated display.
- **Optional: Cloudflare Workers** via OpenNext, for a hosted copy at your own domain. Setup, build settings and caveats are in [docs/FEATURES.md](docs/FEATURES.md#production-build). Each browser keeps its own settings in `localStorage`; nothing is shared between devices.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format check, tests and a production build on every push and pull request.

## Data sources and limits

Weather by [Open-Meteo](https://open-meteo.com/). Sports data from ESPN's publicly accessible but unofficial scoreboard endpoints; not affiliated with ESPN, and the endpoints may change or disappear. The server caches feed responses, shares in-flight requests between viewers, and serves recent data if an upstream request fails. Weather data is not suitable for safety-critical decisions.
