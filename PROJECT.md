# WhatsApp Job Listing Bot — Project Brief

## Goal
Monitor a set of WhatsApp groups/channels that post job openings as images. Automatically
extract structured data from each image, filter for roles relevant to one candidate's
profile — in any profession, not only IT — and surface only the relevant matches via
notification, avoiding manual scrolling through noisy group chats.

## Candidate profile (for the matching/classification step)
One candidate per running bot. The profile, keyword lists, country/flyer language and the
keyword-filter switch live in the `settings` table and are edited from the dashboard.
Uploading a CV drafts the profile and keywords with the configured LLM; the candidate
reviews the draft before saving.

The fresh-install seed is the original author's profile, kept as an example:
- Fullstack developer: C#/.NET, React/TypeScript
- Comfortable with AI tooling (Claude, DeepSeek) and dev automation
- Location: Tegucigalpa, Honduras (prioritize local/remote-friendly roles)
- Actively job hunting — false negatives (missing a good match) are worse than false
  positives (an extra notification to dismiss)

## Pipeline

1. **Capture** — Listen to messages (image attachments) in target WhatsApp groups
   - Library: **Baileys** (Node.js, no browser dependency) — preferred over
     whatsapp-web.js for stability
   - Use a secondary WhatsApp number, read-only (never send to the groups) to
     minimize ban risk
   - Persist session so re-auth isn't needed on every restart

2. **Extraction** — Turn each job-flyer image into structured JSON
   - Use a vision-capable LLM (Claude API) rather than classic OCR — flyer layouts
     vary too much (colors, icons, decorative fonts) for OCR to be reliable
   - Target fields: title, company, location, requirements, salary (if present),
     contact method, source group, timestamp
   - Optional cheap pre-filter: run OCR first; only call the vision LLM when OCR text
     contains the candidate's keywords or is low-confidence — controls API cost at volume

3. **Filtering / classification**
   - Fast pass: keyword filter over the candidate's role/skill keywords (e.g. for the
     seed profile: desarrollador, programador, .NET, React, sistemas, TI) to cheaply
     discard obvious non-matches; can be switched off so every flyer is scored
   - LLM pass: for anything that survives, score relevance against the profile above
     and return a reason — this score/threshold is what gets tuned over time
   - Deduplicate reposted flyers via image hash or text similarity before scoring

4. **Storage**
   - SQLite for MVP (single file, zero setup); migrate to Postgres if it grows
   - Schema: id, source_group, image_path, extracted_json, relevance_score, status
     (new/reviewed/applied/discarded), created_at

5. **Notification**
   - MVP: message to self via the same Baileys client
   - Alternative: Telegram bot (simpler, no ban risk) — worth considering as primary
   - Later: small React dashboard to review/mark status, feeding back into filter tuning

## Suggested stack
- Capture service: Node.js + Baileys
- Backend/API: Node.js for MVP simplicity (can front with .NET later if preferred)
- Extraction/classification: Claude API (vision + text)
- DB: SQLite → Postgres
- Frontend (phase 4, optional): React + TypeScript

## Build phases
1. Connect Baileys, log incoming image messages from target groups (validate capture only)
2. Integrate Claude vision API to extract structured data from each image
3. Add keyword pre-filter + persist to SQLite
4. Add LLM relevance scoring + notification (self-WhatsApp or Telegram)
5. (Optional) React review dashboard + feedback loop to refine scoring over time

## Open decisions to make during setup
- Notification channel: WhatsApp-to-self vs. Telegram bot
- Whether to pre-filter with OCR before the vision LLM call (cost vs. simplicity)
- Target group/channel names to whitelist for monitoring
