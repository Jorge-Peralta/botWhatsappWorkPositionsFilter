# botWorkSearch — WhatsApp Job Listing Bot

Monitors WhatsApp groups/channels that post job openings as flyer images, uses a vision-capable LLM (Claude or Gemini) to extract structured job data from each flyer, scores relevance against a configurable candidate profile, deduplicates reposts, and stores matches in SQLite for review via a notification and a React dashboard.

## Quick start

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy the env template and fill in your values (see [Configuration](#configuration)):
   ```bash
   cp .env.example .env
   ```
3. Start the bot:
   ```bash
   pnpm dev
   ```
4. On first run, link WhatsApp by scanning the printed QR code (or, if `USE_PAIRING_CODE=true`, enter the pairing code on your phone). **Use a secondary WhatsApp number in read-only mode** — the bot never sends messages to monitored groups, which minimizes ban risk, but linking your primary account is not recommended.
5. Session credentials are saved to `SESSION_DIR` (default `./data/auth`), so you won't need to re-link on restart.

## How it works

1. **Capture** — listens for image messages in target WhatsApp groups via [Baileys](https://github.com/WhiskeySockets/Baileys) (no browser dependency).
2. **Extraction** — sends each flyer image to a vision LLM (Claude or Gemini, configurable) to pull out structured fields: title, company, location, requirements, salary, contact method. An optional Tesseract OCR pre-filter can cheaply skip flyers with no IT-adjacent keywords before spending an LLM call.
3. **Filtering** — a fast keyword pass discards obvious non-matches, then an LLM pass scores relevance against your candidate profile and returns a reason.
4. **Deduplication** — reposted flyers are caught via image hashing before they're scored again.
5. **Storage** — matches are persisted to SQLite (`DB_PATH`), with a status field (`new` / `reviewed` / `applied` / `discarded`).
6. **Notification & review** — matches are surfaced via a self-WhatsApp message and can be triaged in the React dashboard.

## Configuration

All configuration is read from environment variables (see `src/config.ts`). Copy `.env.example` to `.env` and set:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API key (required if `EXTRACTION_PROVIDER=anthropic`) — get one from the [Anthropic Console](https://console.anthropic.com/settings/keys) |
| `GEMINI_API_KEY` | — | Gemini API key (required if `EXTRACTION_PROVIDER=gemini`, the default) — get one from [Google AI Studio](https://aistudio.google.com/apikey) (free tier available) |
| `EXTRACTION_PROVIDER` | `gemini` | Vision provider to use: `gemini` or `anthropic` |
| `EXTRACTION_MODEL` | `claude-haiku-4-5` | Primary extraction model (Anthropic) |
| `EXTRACTION_FALLBACK_MODEL` | `claude-sonnet-5` | Fallback extraction model (Anthropic) |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Gemini model used for extraction |
| `MAX_IMAGE_LONG_EDGE` | `1568` | Resize images to this max edge length before sending to the LLM |
| `TARGET_GROUP_JIDS` | — | Comma-separated WhatsApp group JIDs to monitor |
| `USE_PAIRING_CODE` | `false` | Use a pairing code instead of a QR code to link WhatsApp |
| `PAIRING_PHONE_NUMBER` | — | Phone number to request a pairing code for (if `USE_PAIRING_CODE=true`) |
| `SESSION_DIR` | `./data/auth` | Where Baileys stores WhatsApp session credentials |
| `IMAGES_DIR` | `./data/images` | Where downloaded flyer images are stored |
| `GROUPS_FILE_PATH` | `./data/groups.json` | Where discovered group metadata is cached |
| `DB_PATH` | `./data/jobs.db` | SQLite database path |
| `DASHBOARD_PORT` | `3001` | Port for the dashboard API server |
| `LOG_LEVEL` | `info` | Log verbosity (via pino) |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run the bot (capture, extraction, filtering, storage, notification) |
| `pnpm dashboard:api` | Run the dashboard API server |
| `pnpm dashboard:web` | Run the dashboard frontend (Vite dev server) |
| `pnpm test:capture` | Manually test message capture against WhatsApp history |
| `pnpm test:extract` | Manually test extraction against a single image |
| `pnpm typecheck` | Type-check the project with `tsc --noEmit` |

## Project structure

```
src/
  whatsapp/     # Baileys connection, message handling, group discovery
  extraction/   # Vision providers, prompts, OCR pre-filter, image resize
  filtering/    # Keyword filter
  relevance/    # LLM relevance scoring, notification formatting
  dedup/        # Image hashing for repost detection
  storage/      # SQLite access (jobs, settings, images)
  dashboard/    # Express API for the review dashboard
  scripts/      # Manual test scripts (test:capture, test:extract)
web/            # React + Vite + Tailwind review dashboard
data/           # Runtime output — WhatsApp session, images, database (gitignored)
```

## Disclaimer

This is a personal-use automation tool for monitoring job postings in WhatsApp groups you're already a member of. It's provided as-is, with no warranty — see [LICENSE](LICENSE). Use a secondary, read-only WhatsApp account to minimize the risk of your primary number being flagged.

## Future improvements

- Automated test suite (currently only manual scripts under `src/scripts/`)
- CI pipeline

## License

[MIT](LICENSE) © [Jorge-Peralta](https://github.com/Jorge-Peralta)
