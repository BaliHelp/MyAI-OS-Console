# MASTER ECOSYSTEM REPORT: MYAI OS CONSOLE
**Ecosystem Owner:** Boss Bayu (`damnbayu@gmail.com`)  
**Ecosystem Version:** 1.2.0-PROD (Enterprise Gateway Edition)  
**Security Status:** Hardened & Relational  
**Date Generated:** July 16, 2026 (System Local Time)  

---

## 1. PHILOSOPHICAL FOUNDATION: THE CALLING OF MYBUSINESS
As established in **The Constitution of MyBusiness (V1.C01: The Calling)**, MyBusiness was not founded merely to participate in the commercial software industry. It was created to address a deep architectural problem in modern digital civilization: **unnecessary fragmentation and complexity**.

In a world where digital services continue to multiply, individual applications solve isolated problems while simultaneously creating new layers of complexity—requiring users to manage dozens of disconnected accounts, databases, learning curves, and interfaces.

### The Realization
MyAI OS Console is built upon the realization that the primary barrier is not a lack of computational intelligence, but a **lack of integration**. 
* **Connective Intelligence:** The console does not position AI as a standalone product, but as the *connective intelligence* between services. It acts as a centralized "Core Data Center & AI Gateway" (otak terpusat) that serves all business platforms under a single panel.
* **Architecture Precedes Implementation:** Technology must serve people, and simplicity is the ultimate measure of success. The most advanced systems are those that become invisible, allowing businesses to focus on creating value while MyAI OS quietly manages the operational complexity in the background.
* **Multi-Tenant Integration:** By using scoped basis-knowledge (via `client_app_id` filtering), the console ensures that different platforms (e.g. *Indonesian Visas*, *Tropic Tech*, and future App Store/Play Store apps) share a single, unified database and core intelligence pool without mixing user data or domain contexts.

---

## 2. SYSTEM ARCHITECTURE
The application operates on an optimized full-stack architecture designed for high availability, zero-dependency deployment, and fast-path execution.

```
┌────────────────────────────────────────────────────────┐
┌────────────────────────────────────────────────────────┐
│                   CLIENT (Vite + React)                │
│  - Tailwind CSS v4 (High-Contrast Bento Theme)         │
│  - Lucide React (Micro-animations & Icons)             │
│  - Recharts (Interactive usage volume analytics)       │
│  - Bilingual Toggle (ID/EN) & Mode Switchers           │
├───────────────────────────┬────────────────────────────┤
│           ▲               │                            │
│    JSON REST APIs         │ Masked Secrets / SSL       │
│           ▼               ▼                            │
├────────────────────────────────────────────────────────┤
│                 BACKEND SERVER (Express)               │
│  - server.ts compiled to dist/server.cjs (esbuild)    │
│  - Symmetric AES-256 Upstream Key Encryption           │
│  - Bcrypt Password Hashing & Change Verification       │
│  - Priority Key Classifier & Active Failover Router    │
│  - Dynamic Supabase / local db.json Persistence        │
├───────────────────────────┬────────────────────────────┤
│                           │                            │
│    PostgreSQL (Supabase)  │ AI Providers Pool          │
│    (Custom Schema)        │ (Gemini, Claude, GPT,      │
│                           │  Grok, Deepseek)           │
└───────────────────────────┴────────────────────────────┘
```

### Key Technologies:
* **Frontend:** React 19, Vite 6, TypeScript 5.
* **Responsive Visuals:** Tailwind CSS v4 in high-contrast bento style with responsive grid scaling.
* **Data Visualizations:** Recharts SVG area charts mapping daily token consumption.
* **Server Middleware:** Express with standard Helmet security shielding, JSON body-parsing, and path routing.
* **Database Driver:** `@supabase/supabase-js` initializing custom schema isolation (`gateway_console`).
* **Cryptographic Libraries:** Native Node.js `crypto` (AES-256-CBC with scrypt key derivation) and `bcryptjs` (salt rounds 10).

---

## 3. CORE FEATURES & UPSTREAM AI INTEGRATION
The console acts as a unified middleware router supporting the leading AI providers:

1. **Google Gemini (All Technical Works):** Handles OCR, face scans, and document processing. Uses free-tier rotating pools to avoid rate-limiting.
2. **OpenAI GPT (Reasoning & Chat Widget):** Serves as the primary engine for advanced logical reasoning.
3. **Anthropic Claude (Reasoning & Chat - Backup):** Configured as a high-performance backup.
4. **x.ai Grok (Technical Team):** Integrated for technical reasoning, search, and image generation.
5. **Deepseek AI (Reasoning & Chat):** Fully integrated via standard OpenAI-compatible completions format, with custom cyan/sky-blue dashboard indicators.

---

## 4. ADVANCED GATEWAY UPGRADES & SECURITY MECHANISMS

### A. Dynamic API Key Sync & Reconciliation Pipeline
To ensure the `.env.local` configurations and the database are always in perfect agreement, we implemented a robust reconciliation engine in `lib/migrate.ts`:
* **Reconciliation:** On boot or manual sync, the engine matches `.env.local` keys with existing database records.
* **Label Alignment:** Corrects labels and mappings dynamically (e.g. `Gemini Key 1`, `GPT Key 2`).
* **Legacy Clean-up:** Automatically deletes legacy or duplicate keys that are no longer in `.env.local`.
* **Symmetric AES-256-CBC Encryption:** Keys are encrypted using a 32-byte derived key. Plaintext secrets never touch persistent storage or system logs.

### B. Priority-Based Key Selection & Active Failover Loop
Designed to support high availability and cost efficiency (especially for Free Tier keys with strict RPM limits):
1. **Priority Classifier:** Keys labeled with `"Prioritas"` or `"Agent"` (specifically `GPT Key 1 (Agent - Prioritas)` and `GPT Key 5 (Prioritas)`) are automatically placed at the very top of the call pool.
2. **Least-Recently-Used (LRU) Sorting:** Active keys are sorted by oldest `last_used_at` and lowest `usage_count`.
3. **Active Failover Loop:** The gateway (`/api/v1/chat/completions/route.ts`) attempts requests starting from the priority keys. If a key fails (e.g. 401 Invalid, 403 Quota, 429 Rate Limit, or timeout):
   * The gateway **automatically disables the key in the database** (turning its indicator RED in the dashboard).
   * It immediately falls back to try the next active key in the loop under the *same request*, guaranteeing zero downtime for the client.
4. **Visual Indicator Feedback:** The dashboard's *Overview* and *Settings* tabs reflect these keystick status lights instantly.

### C. Secure Admin Credentials Engine
* **Change Password Module:** Fully implemented in the Settings tab.
* **Bcrypt Protection:** Validates the owner's current password using `bcryptjs.compareSync` against the stored hash before applying the new secure hash (generated using `bcryptjs.hashSync` with 10 salt rounds).
* **Logging Prevention:** Fully masked input fields with zero plaintext logging in stdout/stderr.

---

## 5. CORE TAB MODULES

### 1. Overview Tab (`OverviewTab.tsx`)
Displays overall system health, active developer metrics, API key counts, live chronological charting, and a real-time event stream tracking the last 10 processed API gateway calls. Features the **Realtime API Status** card showing connection status lights (Green/Red) for all registered keys with a manual "Refresh" trigger.

### 2. Applications Tab (`AppsTab.tsx`)
Empowers administrators to register client products, configure them to specific business tiers (*internal* or *community*), and issue secure custom client access tokens (`sk_app_xxxx`) with specific provider scopes and daily token rate limits.

### 3. Knowledge Tab (`KnowledgeTab.tsx`)
A collaborative wiki panel allowing custom formatting of the global business profile and specialized policy documents. Includes a fully operational **Gemini AI Sandbox** where administrators can test prompt variations against the current corporate knowledge base.

### 4. Settings Tab (`SettingsTab.tsx`)
Renders three major structural sub-panels:
* **Core Preferences:** Preferred language toggle (ID/EN) and dark/light mode toggle.
* **Ubah Password Owner:** Masked credential input forms backed by server-side bcrypt comparing and hashing.
* **Provider API Keys Management:** Registry of active keys with sky-blue badge indicators for Deepseek, active/disabled toggling buttons, rotation usage counters, and secure addition/deletion forms.

### 5. Audit Logs (`UsageTab.tsx`)
Displays complete API transaction logs searchable by client app, AI provider, request category, or query text, complete with structural CSV exports for client billing.

---

## 6. SECURITY ATTRIBUTE MATRIX

| Security Layer | Implemented Feature | Primary Target / Vector Protected |
| :--- | :--- | :--- |
| **Data At Rest** | AES-256-CBC Symmetric Encryption | Protects upstream API keys (Gemini, Claude, GPT, Grok, Deepseek) from database leaks |
| **Authentication** | Bcrypt Hashing (Salt Cost 10) | Safeguards console administrator credentials from database intrusion |
| **Transport Layer** | Express Helmet Configuration | Blocks clickjacking, content sniffing, and common cross-site attacks |
| **Privacy Control** | Last-4 Masking Representation | Prevents shoulder-surfing exposure in shared administrative workplaces |
| **Cost Overruns** | Client Token Rate-Limiting | Throttles rogue clients from triggering massive loop calls |
| **Resource Safety** | Least-Recently-Used Key Pool Rotation | Distributes API traffic evenly, preventing upstream IP rate limiting |
| **Failover Safety** | Active Failover Retry Loop | Prevents gateway request failures by auto-disabling bad keys and rotating |

---
**Report Compiled & Verified By:**  
Google AI Studio Coding Agent  
**Ecosystem Master Authorization:**  
Boss Bayu / Ecosystem Owner (`damnbayu@gmail.com`)
