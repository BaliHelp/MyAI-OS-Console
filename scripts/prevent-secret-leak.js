#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");

console.log("🔒 [Security] Menjalankan pre-commit hook untuk mendeteksi kebocoran API Key/Secret...");

try {
  // Ambil daftar file yang sedang di-stage (Added, Copied, Modified)
  const stagedFiles = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" })
    .split("\n")
    .map(f => f.trim())
    .filter(Boolean);

  let leakDetected = false;

  // Regex Pola Secret / API Key
  const patterns = [
    // Google Gemini API Key
    { name: "Google Gemini API Key", regex: /AIzaSy[a-zA-Z0-9_\-]{33}/g },
    // Anthropic Claude API Key
    { name: "Anthropic Claude API Key", regex: /sk-ant-api03-[a-zA-Z0-9_\-]{40,}/g },
    // OpenAI Compatible API Key (GPT, Deepseek, OpenRouter)
    { name: "OpenAI Compatible / OpenRouter API Key", regex: /sk-(?:proj-|or-v1-)?[a-zA-Z0-9_\-]{32,}/g },
    // x.ai Grok API Key
    { name: "x.ai Grok API Key", regex: /xai-[a-zA-Z0-9_\-]{32,}/g },
    // Deteksi password/secret kustom yang tertulis langsung
    {
      name: "Variabel Kredensial Langsung (String Panjang >24 karakter)",
      regex: /(?:api_key|api-key|secret|token|password|key_encrypted)\s*[:=]\s*['"`]([a-zA-Z0-9_\-\/\+\.]{24,})['"`]/gi
    }
  ];

  for (const file of stagedFiles) {
    // Lewati file env, binary, dan file konfigurasi tertentu
    if (
      file.includes(".env") || 
      file.endsWith(".png") || 
      file.endsWith(".jpg") || 
      file.endsWith(".webp") || 
      file.endsWith(".ico") || 
      file.endsWith(".pdf") || 
      file.endsWith(".zip") ||
      file.endsWith(".svg") ||
      file === "package-lock.json"
    ) {
      continue;
    }

    try {
      // Ambil isi staged content dari file tersebut (bukan file fisik saat ini agar akurat)
      const content = execSync(`git show :"${file}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Abaikan baris komentar atau baris yang secara eksplisit dikecualikan jika ada
        if (line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("/*")) {
          // Tetap scan jika itu memuat sk- atau AIzaSy yang mencurigakan, tapi lewati komentar penjelasan template
          if (!line.includes("sk-") && !line.includes("AIzaSy")) {
            return;
          }
        }

        // Jalankan pencocokan pola
        for (const p of patterns) {
          p.regex.lastIndex = 0; // Reset state regex global
          const match = p.regex.exec(line);
          if (match) {
            // Hindari positif palsu: abaikan placeholder yang aman
            const matchedValue = match[0];
            if (
              matchedValue.includes("placeholder") || 
              matchedValue.includes("your-api-key") ||
              matchedValue.includes("••••••••") ||
              // Abaikan jika isinya hanya sk-proj- tanpa value panjang
              (matchedValue.startsWith("sk-proj-") && matchedValue.length < 15)
            ) {
              continue;
            }

            console.error(`\n❌ [BLOCKED] Terdeteksi potensi kebocoran kredensial di file: ${file}:${index + 1}`);
            console.error(`   Tipe Kredensial : ${p.name}`);
            console.error(`   Baris Kode      : "${line.trim().substring(0, 100)}..."`);
            console.error(`   ⚠️  Silakan hapus kunci rahasia/API key mentah ini sebelum melakukan commit!\n`);
            leakDetected = true;
          }
        }
      });
    } catch (e) {
      // Abaikan jika file gagal di-show (misalnya file baru kosong)
    }
  }

  if (leakDetected) {
    console.error("⛔ Commit dibatalkan otomatis oleh pre-commit hook keamanan MyAI OS.\n");
    process.exit(1);
  } else {
    console.log("✅ [Security] Tidak ditemukan kebocoran API Key/Secret. Melanjutkan commit...");
    process.exit(0);
  }
} catch (err) {
  console.error("⚠️  Gagal menjalankan script pre-commit hook:", err.message);
  process.exit(0); // Jangan blokir jika script hook itu sendiri crash
}
