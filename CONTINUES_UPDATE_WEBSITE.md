# CONTINUOUS UPDATES & PRODUCTION HARDENING ROADMAP
**Project Name:** MyAI OS Console  
**Target Git Branch:** `main` (origin)  
**Lead Architect:** Boss Bayu (`damnbayu@gmail.com`)  
**Ecosystem Version:** 1.4.0-PROD  

---

## 1. INTRODUCTION & CURRENT STATUS
The **MyAI OS Console** serves as the central "Brain" (Gateway) and Data Center that consolidates AI management under a single panel. It allows the owner to monitor, register, audit, and coordinate AI operations across all business platforms (like *Indonesian Visas*, *Tropic Tech*, and future mobile apps on the App Store and Play Store) under a single unified corporate identity while maintaining absolute security and cost control.

With the release of **Version 1.4.0-PROD**, the system is fully hardened with production-ready relational storage (Supabase), authenticated **AES-256-GCM** upstream key encryption, automatic LRU key rotation pools, bcrypt-hashed credentials, a state-of-the-art **Priority-Based Failover Loop**, a dedicated **Security Hardening Pass** (July 22, 2026 — see section 2.E), and a **Gateway Routing Correctness & Multi-Tenant Update** (section 2.F) that fixes vision routing, adds a persona-free multi-tenant chat field, and makes field/tier routing reproducible.

---

## 2. PRODUCTION HARDENING PROGRESS & CHECKLIST

### A. Authentication & Credentials Security (COMPLETED & HARDENED)
* [x] **Bcrypt Password Hashing:** Replaced legacy plaintext verification with industry-standard bcrypt hashes. Passwords are encrypted server-side with 10 salt rounds (`bcryptjs.hashSync`).
* [x] **Secure Password Update Form:** Built an interactive password reset engine in the Settings panel requiring current password validation via `bcryptjs.compareSync` before applying a new secure hash.
* [x] **Plaintext Masking & Zero Logging:** Both the login inputs and password reset forms use strictly masked password fields and never log sensitive credential inputs in system stdout/stderr.
* [x] **No Plaintext-Password Fallback:** Login now hard-fails (500) on any stored hash that is not bcrypt, instead of falling back to a direct plaintext comparison. The hardcoded `ADMIN_EMAIL` default was removed from source.
* [x] **Secured Password Recovery:** `forgot-password` is gated behind the server-only `PASSWORD_RESET_SECRET`, issues a fresh random password each time, is rate-limited and audit-logged, and fails closed (503) when unconfigured. (See section 2.E.)

### B. Relational Storage & Supabase Migration (COMPLETED & HARDENED)
* [x] **Supabase PostgreSQL Integration:** Transitioned primary storage to a robust relational engine. If credentials are provided in `.env`, the server automatically initializes connections.
* [x] **Auto-Migration Pipeline:** Implemented an database initializer that auto-migrates DDL schemas at server startup, provisioning all necessary tables and RLS constraints if not present.
* [x] **Local Fallback Persistence:** Retained a file-based `db.json` engine as a developer fallback to guarantee 100% server uptime even in the event of third-party cloud connection latency.

### C. Provider Key Management & Active Failover (COMPLETED & HARDENED)
* [x] **Authenticated Key Encryption:** Provider API keys are encrypted with **AES-256-GCM** (authenticated, random per-encryption salt) before being written to the database — zero plaintext secrets in persistent storage, and any ciphertext tampering is detected. Backward-compatible with legacy CBC records.
* [x] **Masked-by-Default Reads:** The provider-key listing returns masked values only (`••••••••${last_4}`). Full plaintext is available exclusively per-key via the audit-logged `GET /api/provider-keys/[id]/reveal` endpoint — no bulk plaintext exposure.
* [x] **CSPRNG Client Tokens:** Client API keys (`sk_app_xxxx`) are generated with `crypto.randomBytes`, not `Math.random()`.
* [x] **SSRF Egress Guard:** URL import validates the hostname and its resolved DNS/IP, rejecting private/internal targets.
* [x] **Priority-Based Key Selection:** Configured the gateway to prioritize keys containing `"Prioritas"` or `"Agent"` in their labels (specifically `GPT Key 1 (Agent - Prioritas)` and `GPT Key 5 (Prioritas)`) to always try them first.
* [x] **Active Failover Loop:** Implemented a retry loop inside the completions API. If a key fails (401, 403, 429, or timeout), it is automatically disabled in the database, and the gateway retries using the next active key under the same request.
* [x] **Bento Key Registry UI:** Integrated a premium interface with provider choice (Gemini, Claude, GPT, Grok, Deepseek), optional tracking labels, active/disabled state toggles, and deletion triggers.

### D. Multi-Provider AI Integrations (COMPLETED)
* [x] **Google Gemini Integration:** Supported Gemini free-tier rotating pools for technical/multimodal work.
* [x] **x.ai Grok Integration:** Fully integrated Grok-2 and Grok-4.5 endpoints for reasoning and creative assets.
* [x] **Deepseek AI Integration:** Fully integrated Deepseek chat completions (`deepseek-chat`) with standard OpenAI-compatible payloads and a custom sky-blue status badge.

### E. Security Hardening Pass — July 22, 2026 (COMPLETED & PUSHED)
A dedicated security review closed a set of confirmed vulnerabilities. All items are `tsc`-clean, build-clean, committed (`2ce953c`, `d24be84`), and pushed to `origin/main`.

* [x] **CRITICAL — Account-takeover on `forgot-password` closed:** was unauthenticated and reset any known account to a hardcoded `"Bali2026"`. Now gated by server-only `PASSWORD_RESET_SECRET`, random reset password, rate-limited, audit-logged, fail-closed (503).
* [x] **CRITICAL — Provider-key plaintext exposure closed:** list endpoint returns masked only; plaintext moved to the audit-logged per-key `reveal` endpoint.
* [x] **HIGH — Weak client-key entropy fixed:** `Math.random()` → `crypto.randomBytes`.
* [x] **HIGH — SSRF in URL import closed:** hostname + resolved-DNS/IP validation against private/internal ranges.
* [x] **MEDIUM — Plaintext-password login fallback removed:** non-bcrypt hashes hard-fail; hardcoded `ADMIN_EMAIL` removed from source.
* [x] **MEDIUM — Encryption upgraded to AES-256-GCM:** authenticated cipher + random per-encryption salt, backward-compatible with legacy CBC records (verified via round-trip test).
* [x] **Lint restored:** `next lint` (removed in Next 16) replaced by a native flat-config `eslint.config.js`; `npm run lint` works again (surfaced 24 pre-existing, unrelated issues left for a separate pass).

> **⚠️ PENDING OPERATOR ACTION:** Add `PASSWORD_RESET_SECRET` to Vercel (`my-ai-os-console`, **Production + Preview**) — value already in local `.env.local`. Until added, `forgot-password` returns 503 (safe / fail-closed). A **redeploy is required** for the new variable to take effect.

### F. Gateway Routing Correctness & Multi-Tenant Update — July 22, 2026 (COMPLETED)
Reconciling a consumer-side strategy memo against the actual source confirmed the Gateway already ships per-application keys and per-app usage attribution (the memo's headline ask was a no-op). This pass fixes what the memo missed and what it got right. All items are `tsc`-clean and build-clean.

* [x] **Vision-capability guard (real bug):** `supportsVision` was declared per adapter but never enforced — images sent to non-vision providers (deepseek/grok) were silently dropped and hallucinated. The gateway now returns `422` when an image hits a field with no in-scope vision provider, and filters non-vision providers out of every tier while an image is present.
* [x] **Persona-free multi-tenant field:** new `chatbot_generic` field; a caller-supplied `system` message (previously discarded) is now honored for free-form non-persona fields, while persona fields (MyVISA AI) and strict-schema OCR/extraction fields deliberately ignore it.
* [x] **Authoritative routing migration:** `supabase/migrations/20260722_authoritative_field_routing.sql` deduplicates `gw_field_pool_assignments`, adds `UNIQUE (field_key, provider)`, and re-asserts the full routing table idempotently (OCR pinned to gemini → gpt → claude; `structured_extraction` codified). Resolves the contradictory OCR seed history.
* [x] **Per-app cost pivot:** `components/CostsTab.tsx` adds a "Rincian per Aplikasi" breakdown from `gw_usage_logs.app_name`.

> **⚠️ PENDING OPERATOR ACTION:** Run `supabase/migrations/20260722_authoritative_field_routing.sql` in the Supabase SQL Editor to reconcile live routing with the source. Until then, live OCR tiering follows the older, contradictory seed state.

---

## 3. FUTURE EXPANSION ROADMAP: DATA CENTER & MOBILE INTEGRATION
Aligned with the vision of **The Constitution of MyBusiness**, MyAI OS Console will expand to serve as the unified Data Center and AI service engine for all company websites and mobile clients:

### Phase 1: Centralized OCR & Multimodal Document Processing (Short-Term)
* [ ] **Multimodal OCR Endpoint:** Create a specialized endpoint (`POST /api/v1/ocr`) that accepts uploaded images/PDFs (e.g. scan results of visa documents or passports).
* [ ] **Structured Extraction:** The gateway will route these uploads to Gemini (multimodal), extract structured JSON data (name, passport number, expiry, nationality), and return the clean data to the caller while storing audit logs.

### Phase 2: Supabase Storage Integration & File Data Center (Medium-Term)
* [ ] **Secure Storage Buckets:** Set up Supabase Storage buckets to store uploaded files (TXT, HTML, Markdown, and scan images) in a single secure environment.
* [ ] **Document Metadata Indexing:** Connect file references to client application IDs, allowing the AI model to query specific document contents dynamically (File RAG).

### Phase 3: Mobile App & Store Launch (Long-Term)
* [ ] **Mobile App Store / Play Store Build:** Develop a lightweight cross-platform mobile client that connects to the MyAI OS backend.
* [ ] **Edge Security Enforcements:** Enforce secure token authentication (`gw_api_keys`) on mobile client app requests, ensuring client-side secrets cannot be extracted or compromised.

---

## 4. HOW TO RUN, COMPILE, AND DEPLOY

### Local Development
```bash
# Start development environment with automatic hot reloading
npm run dev
```

### Production Compilation
Before deploying to production containers, bundle the assets and server entry point:
```bash
# Run production build script
npm run build
```

### Required Environment Variables on Vercel
Mirror every variable from `.env.local` into **Vercel → Settings → Environment Variables** (Production + Preview), including the security-critical secrets:
* `SESSION_SECRET`, `PROVIDER_KEY_ENCRYPTION_SECRET`
* **`PASSWORD_RESET_SECRET`** — required for password recovery; without it `forgot-password` returns 503 (fail-closed). Do **not** grant this secret the Development scope.

Any env-var change requires a **redeploy** to take effect on the live deployment.

---
**Approved & Signed By:**  
Boss Bayu (`damnbayu@gmail.com`)  
**Ecosystem Lead Architect & Founder**
