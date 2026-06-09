# Secret scan — 2026-06-08

Tool: gitleaks v8.30.1. Run on `cleanup` branch worktree. Allowlist for
known false positives lives in `.gitleaks.toml` at repo root.

## Headline

**Zero real secrets in git history.** 416 commits scanned. All 36 raw findings
were either TypeScript object-literal property keys (33) or CSV data rows in a
file no longer in the tree (3). After allowlisting these false-positive
patterns, history is clean.

## Commands used

```bash
gitleaks detect --no-banner --redact                # scans git history
gitleaks detect --no-banner --redact --no-git       # scans current tree (incl. gitignored .env)
```

## Findings (post-allowlist)

| Scan | Raw | After allowlist | Class |
|---|---:|---:|---|
| Git history (416 commits) | 36 | **0**¹ | ✅ Clean |
| Current tree, no-git (includes gitignored `.env`) | 23 | **12** | ⚠️ Real, but not in git |

¹ The 12 remaining current-tree findings are all in **gitignored** `.env` files —
they live only on the developer's machine, not in git.

## What the 12 remaining findings are

All in `backend-main/.env` and `frontend-main/.env` (both gitignored):

- `backend-main/.env` — `SENDGRID_API_KEY`, `AZURE_AD_CLIENT_SECRET`,
  `ALERT_TELEGRAM_BOT_TOKEN`, `WHONGHUB_API_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `KOBO_API_TOKEN`, `KOBO_WEBHOOK_SECRET`, `OPENAI_API_KEY` (or similar
  `AGENT_LLM_*`).
- `frontend-main/.env` — `VITE_FIRMS_API_KEY`, `VITE_MAPBOX_ACCESS_TOKEN`,
  `VITE_OPENWEATHER_API_KEY`, and one JWT-shaped string.

These are **real keys on the dev machine**. They are not in git and never have
been. But before seeding the new shared repo, they must be:

1. **Rotated** at their providers — assume any value sitting in a dev `.env`
   has been seen by other tools or copied at some point.
2. The frontend ones (`VITE_*`) that are no longer referenced in code
   (FIRMS/Mapbox/OpenWeather per Phase 1 env audit) should also be removed
   from `frontend-main/.env` outright.

## Why the 33 source-file matches are false positives

Gitleaks' `generic-api-key` rule fires on any high-entropy string after `key:`
or `secret:`. Our forms have lines like:

```ts
{ status: 'SECTION_A_PENDING', dataKey: 'section_1_data',
  sigKey: 'section_1_signature', ... }
```

`'section_1_signature'` is a property-name string, not a secret. The
`.gitleaks.toml` allowlist explicitly matches these `sigKey:` and column-`key:`
patterns under the relevant file paths.

## How to reproduce

```bash
cd cleanup-worktree
gitleaks detect --no-banner --redact          # → no leaks
gitleaks detect --no-banner --redact --no-git # → 12 in .env (real keys, gitignored)
```

## Before seeding the new repo

- [ ] Rotate every key listed in §"What the 12 remaining findings are."
- [ ] Confirm the new repo's `.gitignore` covers `.env`, `.env.*`,
      `.env.production`, `.env.local`.
- [ ] Do NOT copy `.env` files into the new repo — only `.env.example`.
- [ ] After seeding, run `gitleaks detect --no-banner` on the new tree and
      confirm zero findings.
