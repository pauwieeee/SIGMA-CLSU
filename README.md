# SIGMA — Scholarship Information and Grants Management Analytics

CLSU Office of Admissions internal admin system. React + TypeScript + Vite + Tailwind, backed by Supabase (Postgres, Auth, Edge Functions).

## 1. Supabase project setup

1. Create a project at supabase.com.
2. In the SQL Editor, run the migrations **in order**:
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_functions_views.sql`
   - `supabase/migrations/0004_notification_triggers.sql`
   - `supabase/migrations/0007_trend_functions.sql`
   - `supabase/migrations/0008_expiring_soon_cron.sql` (requires the `pg_cron` extension — see note below if it errors)
3. Run the seed data, also in order:
   - `supabase/seed/0001_reference_data.sql`
   - `supabase/seed/0002_fix_agency_grouping.sql` through `0006_sample_student_scholarships.sql` (corrective patches — only needed if you seeded before these were added; a fresh install can skip straight to `0001`, since it already has the corrected data baked in)
4. Create your first admin account: Authentication → Users → Add User (email/password). There is no public sign-up — all accounts are provisioned this way.

**If `0008_expiring_soon_cron.sql` errors on `create extension pg_cron`**: `pg_cron` isn't available on every Supabase plan/region. Enable it under Database → Extensions in the dashboard first; if it's genuinely unavailable on your plan, tell me and I'll swap the cron job for an externally-triggered Edge Function you call from an outside scheduler instead.

## 2. Frontend env

```
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API.

## 3. Install & run

```
npm install
npm run dev
```

## 4. SIGMA Assistant (Gemini) Edge Function

### Deploy

```
supabase functions deploy sigma-assistant
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get a Gemini API key from Google AI Studio (aistudio.google.com/apikey) if you don't have one. Never put this key in `.env` or any client-side file — it must only exist as a Supabase secret, read server-side by the Edge Function.

**If you've ever pasted a Gemini key into a chat, doc, or committed file**: treat it as compromised. Regenerate it in Google AI Studio (API Keys → delete the old one, create a new one) before running `supabase secrets set` with the replacement.

### Verify model slugs before relying on the fallback chain (Task 1)

`MODEL_LIMITS` in `supabase/functions/sigma-assistant/index.ts` was transcribed from the Rate Limit dashboard's *display names*, not confirmed API slugs — the "Gemini 3.x" ones in particular are unverified. After deploying, trigger the built-in verification hook once:

```
curl -X POST https://your-project-ref.supabase.co/functions/v1/sigma-assistant \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"debug":"list-models"}'
```

Then check **Supabase Dashboard → Edge Functions → sigma-assistant → Logs** for two lines: the full list of model slugs your key can actually call, and which `MODEL_LIMITS` slugs weren't found in that list. Fix any mismatches directly in `MODEL_LIMITS`.

### Manual test checklist (run after every deploy)

Open the SIGMA Assistant panel in the app and verify:

- [ ] "Which students have duplicate scholarships this semester?" returns real names from your data (or "no open duplicate flags" if none exist)
- [ ] "How many BFAR scholars are in Engineering?" (or your actual college names) returns a real count
- [ ] A suggested chip ("Scholars per college", "Expiring this month") returns a sensible answer
- [ ] Asking something unrelated to scholarships still gets a graceful reply, not a crash

### Automatic model fallback

`FALLBACK_CHAIN` is derived from `MODEL_LIMITS` — filtered to models with RPM > 0 on this tier, sorted highest-RPM-first — rather than hardcoded, so updating a quota number in `MODEL_LIMITS` automatically reorders/prunes the chain. At request time the function tries each model in order, and moves to the next automatically on a 404 (wrong/renamed slug) or 429 (rate limited), so one model being wrong or exhausted doesn't take the assistant down. The model actually used is invisible to the end user — every success looks identical in the chat regardless of which model served it. Only returns `gemini_rate_limited` (shown to the user as "SIGMA Assistant is at capacity right now — please try again in a minute") if every model in the chain fails.

A lightweight **sticky preference** (per warm Edge Function instance only — resets on cold start, so this is an optimization, not something the fallback logic depends on) remembers the last model that succeeded and a 60s cooldown for any model that just got rate-limited, so a request doesn't always restart from the top of the chain.

### Error handling coverage

The function returns a distinct `code` for each failure mode, and the chat UI shows a different message for each (see `errorMessageFor` in `src/components/assistant/SigmaAssistant.tsx`):

| Code | Cause | Shown when |
|---|---|---|
| `config_missing` | A secret isn't set on this deployment | Test by temporarily unsetting a secret |
| `gemini_unauthorized` | Gemini rejected the API key | Test with an invalid key |
| `gemini_rate_limited` | Every model in the fallback chain returned 429/404/failed | Hard to trigger manually (would need to exhaust all 7 models' quotas); covered by code review |
| `gemini_timeout` | Request took >15s | Hard to trigger manually; covered by code review |
| `gemini_bad_response` | Gemini responded but with no usable text | Hard to trigger manually; covered by code review |
| `network_error` | Client couldn't reach the function at all | Test by disabling network/wrong project URL |

Every failure is also logged server-side via `console.error` inside the function — check **Supabase Dashboard → Edge Functions → sigma-assistant → Logs** to diagnose issues after deployment, since client-side errors intentionally don't leak internal details.

## 5. Build & deploy

```
npm run build
```

Deploy `dist/` to Vercel, with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set as Vercel environment variables.

## Notes / assumptions to verify

- **College ↔ program mapping**: originally inferred, then corrected against the official CLSU college/program list across `supabase/seed/0003`–`0005`. A fresh install's `0001_reference_data.sql` already reflects the corrected mapping.
- **Duplicate detection** runs automatically via a Postgres trigger (`detect_duplicates_for_student`) whenever a `student_scholarships` row is inserted/updated: a flag is created when the same student has 2+ *Active* scholarships in the same academic year + semester. This does **not** retroactively scan existing data — see the "Re-scan for Duplicates" admin action for that.
- **Expiring Soon** is now automated via a daily `pg_cron` job (`flag_expiring_scholarships`, migration `0008`) that sets a dedicated `scholarships.is_expiring_soon` flag — kept separate from the `status` column so it never overwrites a manually-set status. Each run is logged to `cron_run_logs`.
- **Trend numbers** (Total Scholars %, Active Scholarships added this month, Duplicate-Flag Count vs last semester) are computed by real Postgres functions (`get_scholar_trend`, `get_scholarships_added_this_month`, `get_duplicate_flag_trend`, migration `0007`) — shared by the Dashboard and Reports & Analytics pages. When there's no prior period to compare against, they report "No prior data" rather than a fabricated percentage.
- **RLS** currently grants full access to any authenticated user (single Admin role, per your requirements). Extending to Staff/Viewer roles later only requires tightening the policies in `0002_rls_policies.sql`.
