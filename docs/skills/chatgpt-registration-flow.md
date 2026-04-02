# ChatGPT Registration Flow Runbook (Live-Validated)

## Purpose

Durable project-local reference for ChatGPT signup continuation behavior, based on browser-validated live flow.

Use this when maintaining/fixing registration/login continuation handling, especially around `continue_url` after OTP/login.

## Source-of-Truth Flow (validated in live browser QA)

1. `https://chatgpt.com/auth/login`
2. Click **Sign up for free**
3. `https://auth.openai.com/log-in-or-create-account`
4. Submit email via:
   - `button[name="intent"][value="email"][type="submit"]`
5. `create-account/password`
6. `email-verification`
7. `about-you`
8. `https://chatgpt.com/` logged-in onboarding

## Critical continuation facts

- `about-you` is a **real continuation gate** in signup flow.
- Do **not** treat `about-you` as meaningless fallback/noise URL.
- `about-you` can appear in at least two UI variants:
  - **Birthday variant**: date input (`MM/DD/YYYY`-like or split birthday fields)
  - **Age variant**: full name + age
- `add-phone` is also a valid continuation gate in some flows.

## Engineering handling rules

When processing post-OTP/post-login redirects and `continue_url`:

1. Keep `about-you` / `add-phone` continuation URLs as valid chain targets.
2. Do not discard cached/create-account/OTP `continue_url` only because it points to `about-you` or `add-phone`.
3. Prefer explicit detection for both hyphen and underscore URL variants when normalizing:
   - `about-you` / `about_you`
   - `add-phone` / `add_phone`
4. Preserve existing behavior outside continuation-gate handling.

## Debug checklist

If registration completion fails after OTP/login:

1. Log raw `continue_url` sources:
   - OTP response continue URL
   - create_account cached continue URL
   - workspace/select continue URL
2. Confirm whether URL hits:
   - `auth.openai.com/about-you` (or `_` variant)
   - `auth.openai.com/add-phone` (or `_` variant)
3. Verify code path does **not** blank/discard these URLs.
4. Follow redirect chain and inspect whether callback/session capture occurs later.

## Relevant code areas in this repo

- `src/core/register.py`
  - native backup token-exchange continuation selection
  - redirect follow-up and callback/token capture
- `src/config/constants.py`
  - `OPENAI_PAGE_TYPES` (continuation-page identifiers)
- `tests/test_registration_engine.py`
  - continuation handling tests
