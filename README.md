# MyAI OS™ Console
> **Infrastruktur Kecerdasan Buatan Terpusat untuk Ekosistem Bali Enterprises Group & IndoDesign.Website**

MyAI OS™ adalah sistem **AI Gateway & Control Panel** terpadu yang menyatukan seluruh integrasi kecerdasan buatan (Large Language Models, Vision, dan OCR) untuk produk-produk di bawah naungan Bali Enterprises Group, termasuk layanan web premium dari **IndoDesign.Website**, **Indonesian Visas Agency**, dan **Tropic Tech**.

Console ini berfungsi sebagai pusat kendali administratif untuk mengelola kunci API penyedia AI, memantau kesehatan koneksi, menganalisis biaya, melacak audit keamanan, serta menyimpan repositori data terstruktur (Data Center).

---

## 🚀 Fitur Utama

### 1. Multi-Tenant AI Routing & Priority Fallback
* Perutean permintaan pintar berdasarkan prioritas tingkat (tier) aplikasi.
* Algoritma rotasi kunci **Least Recently Used (LRU)** mencegah penumpukan batas rate limit (Rate Limit Exhaustion).
* Fitur **Auto-Fallback** instan: Jika penyedia utama (misal: Gemini) mengalami kegagalan, gateway secara otomatis mengalihkan beban kerja ke penyedia cadangan (misal: Claude atau GPT) tanpa memutus koneksi klien.

### 2. Shared Knowledge Base (RAG)
* Basis pengetahuan bisnis global terpusat yang dapat diakses langsung oleh seluruh asisten AI di ekosistem.
* Mendukung RAG (Retrieval-Augmented Generation) dinamis per produk.
* Dilengkapi dengan "Gateway Helper" berbasis Gemini 2.0 Flash untuk interaksi tanya jawab langsung admin terhadap basis data dokumen.

### 3. Data Center Storage (Card View & Export)
* Repositori data persisten untuk seluruh berkas hasil ekstraksi OCR (KTP, Paspor, Dokumen Finansial) dan riwayat interaksi AI (Chatbot, Content Generation).
* Pengelompokan data pintar berdasarkan Tenant Aplikasi + Field Key.
* Ekspor data instan ke format **JSON**, **CSV**, atau **TXT** langsung dari antarmuka popup detail.

### 4. Kesehatan Sistem (System Health Check)
* Pengujian latensi dan konektivitas API provider secara real-time.
* Panel otomatis hanya mendiagnosis kunci provider berstatus `'active'` (Gemini, GPT, Claude, Grok, Deepseek) untuk menghindari peringatan kegagalan palsu pada kunci non-aktif.

### 5. Analitik & Estimasi Biaya Pintar
* Dasbor visual biaya AI terperinci berdasarkan filter rentang waktu (Harian, 1 Bulan, 6 Bulan, dst.).
* Deteksi dan pemisahan otomatis trafik pengujian (`Internal Sandbox`) agar tidak mengaburkan pelaporan pengeluaran operasional riil.
* Konstanta harga referensi per provider terpusat sehingga mudah disesuaikan secara manual di masa mendatang.

### 6. Pengerasan Keamanan & Audit Log
* **Audit Log**: Pencatatan riwayat setiap aksi administratif sensitif (login, ganti password, rotasi secret, pembuatan/pencabutan API key).
* **AES-256-GCM Encryption**: Semua kunci API pihak ketiga disimpan terenkripsi di database menggunakan secret 64-karakter hex.
* **No Public Registration**: Akses register publik dinonaktifkan secara fisik; seluruh halaman administrasi diamankan di balik middleware role verification (`role === 'owner'`).

---

## 🛠️ Stack Teknologi

* **Frontend & Backend API**: [Next.js 16](https://nextjs.org/) (App Router & Server Actions)
* **Database**: [Supabase](https://supabase.com/) / PostgreSQL
* **Otentikasi & Keamanan**: JWT Session, Bcrypt Hashing, AES-256-GCM Encryption
* **Gaya UI**: Tailwind CSS (Bento Grid Dark Mode)
* **Penyedia AI**: Google Gemini API, OpenAI GPT, Anthropic Claude, xAI Grok, Deepseek API

---

## 💻 Panduan Instalasi Lokal

### Prasyarat
* Node.js v20 atau lebih baru
* Akun & Database Supabase aktif

### 1. Kloning Repositori
```bash
git clone https://github.com/BaliHelp/MyAI-OS-Console.git
cd MyAI-OS-Console
```

### 2. Konfigurasi Environment Variables
Buat berkas `.env.local` di root direktori proyek Anda dan lengkapi variabel berikut (gunakan [.env.example](.env.example) sebagai acuan):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Encryption Secrets (Gunakan 64-character hex acak)
SESSION_SECRET=<your-random-hex>
PROVIDER_KEY_ENCRYPTION_SECRET=<your-random-hex>

# Admin Credentials
ADMIN_EMAIL=damnbayu@gmail.com
ADMIN_PASSWORD_HASH=<bcrypt-hash-dari-sandi-admin>
```

### 3. Inisialisasi Struktur Database
Jalankan berkas migrasi SQL yang berada di dalam folder `supabase/migrations/` ke Supabase SQL Editor Anda untuk membentuk tabel:
- `gw_client_apps`
- `gw_api_keys`
- `gw_provider_keys`
- `gw_usage_logs`
- `gw_data_center`
- `gw_audit_logs`
- `gw_chat_personas`

### 4. Menjalankan Server
```bash
npm install
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

---

## ☁️ Panduan Deploy ke Vercel

1. Hubungkan repositori GitHub `BaliHelp/MyAI-OS-Console` ke Vercel Dashboard Anda.
2. Masukkan seluruh variabel lingkungan (Environment Variables) dari `.env.local` ke **Vercel Settings → Environment Variables**.
3. **Catatan**: Kunci API Provider (Gemini/GPT/Claude) **TIDAK PERLU** diisikan di Vercel Dashboard karena semuanya dikelola, dienkripsi, dan dibaca secara dinamis dari tabel database Supabase.
4. Klik **Deploy**. Vercel akan otomatis menyetel `NODE_ENV=production` dan mengompilasi build Next.js.

---

## 🔒 Hak Cipta & Lisensi
Copyright © 2026 **MyAI OS™** All Rights Reserved.  
Infrastruktur Internal — Bali Technology & PT Indonesian Visas Agency.
