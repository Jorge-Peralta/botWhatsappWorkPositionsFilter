# botWorkSearch — WhatsApp Job Listing Bot

Monitors WhatsApp groups/channels that post job openings as flyer images, uses a vision-capable LLM (Claude or Gemini) to extract structured job data from each flyer, scores relevance against a configurable candidate profile, deduplicates reposts, and stores matches in SQLite for review via a notification and a React dashboard.

It works for a candidate in **any profession** — developer, nurse, accountant, driver, salesperson. Upload a CV in the dashboard and the bot drafts the candidate profile and keyword lists for you.

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
6. Set up the candidate profile (see [Candidate setup](#candidate-setup)) — a fresh install starts with an example software-developer profile.

## Candidate setup

Run `pnpm dashboard:api` and `pnpm dashboard:web`, then open the **Settings** tab:

1. **Generate from CV** — upload a PDF, `.txt` or `.md` CV (up to 5 MB). The configured LLM provider drafts:
   - a candidate profile (target roles, seniority, skills, certifications, location, dealbreakers),
   - Spanish and English role keywords, skill keywords, and case-sensitive acronyms.

   The draft only fills the form. Review it, complete any `(fill in)` lines (salary floor, dealbreakers, work arrangement), then **Save**.
2. **Country / flyer language** — where the monitored groups post from (default `Honduras` / `Spanish`). Used as a hint in the extraction and relevance prompts; leave both blank to drop the hint.
3. **Filter flyers by keywords** — on by default: flyers with none of your keywords are skipped before any LLM call. Turn it off if flyers for your field rarely share clear keywords; every flyer is then extracted and scored (no keyword misses, more API calls).
4. **Candidate gender** — `Not specified` by default. When set, flyers that explicitly ask for a different gender (common on local flyers) get a low score with the reason stated. It is never inferred from the CV.
5. **Notification threshold** — minimum relevance score (0-100) that triggers a WhatsApp notification.

Settings apply live; the bot doesn't need a restart.

## How it works

1. **Capture** — listens for image messages in target WhatsApp groups via [Baileys](https://github.com/WhiskeySockets/Baileys) (no browser dependency).
2. **Extraction** — sends each flyer image to a vision LLM (Claude or Gemini, configurable) to pull out structured fields: title, company, location, requirements, salary, contact method. A Tesseract OCR pre-filter cheaply skips flyers that contain none of the candidate's keywords before spending an LLM call.
3. **Filtering** — a fast keyword pass discards obvious non-matches (can be turned off), then an LLM pass scores relevance against the candidate profile — role and skills fit, location, seniority — and returns a reason.
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
| `pnpm test` | Run the unit tests (Node's built-in test runner via tsx) |
| `pnpm typecheck` | Type-check the project with `tsc --noEmit` |

## Project structure

```
src/
  whatsapp/     # Baileys connection, message handling, group discovery
  extraction/   # Vision providers, prompts, OCR pre-filter, image resize
  filtering/    # Keyword filter
  relevance/    # LLM relevance scoring, notification formatting
  profile/      # CV upload → drafted candidate profile and keywords
  dedup/        # Image hashing for repost detection
  storage/      # SQLite access (jobs, settings, images)
  dashboard/    # Express API for the review dashboard
  scripts/      # Manual test scripts (test:capture, test:extract)
  testSupport/  # Shared helpers for unit tests (*.test.ts next to the code)
web/            # React + Vite + Tailwind review dashboard
data/           # Runtime output — WhatsApp session, images, database (gitignored)
```

## Disclaimer

This is a personal-use automation tool for monitoring job postings in WhatsApp groups you're already a member of. It's provided as-is, with no warranty — see [LICENSE](LICENSE). Use a secondary, read-only WhatsApp account to minimize the risk of your primary number being flagged.

## Future improvements

- Broader automated tests — unit tests cover keywords, prompts, settings and CV upload parsing; WhatsApp capture and live LLM calls are still checked manually via `src/scripts/`
- CI pipeline

## License

[MIT](LICENSE) © [Jorge-Peralta](https://github.com/Jorge-Peralta)
