/**
 * lib/file-parser.ts
 *
 * Modul terpusat untuk deteksi dan parsing semua tipe file yang diterima gateway.
 * Mengembalikan konten yang sudah siap dikirim ke provider AI.
 *
 * Tipe yang didukung:
 *   - image/* (JPEG, PNG, HEIC, WEBP) → konversi ke WebP, kirim via vision pipeline
 *   - application/pdf → coba ekstrak teks; jika gagal (scanned), kirim PDF raw ke Gemini
 *   - application/vnd.openxmlformats-officedocument.wordprocessingml.document → mammoth
 *   - text/csv, text/plain → baca langsung sebagai teks
 *   - Lainnya → kembalikan error 400
 */

import sharp from "sharp";

// ─────────────────────────────────────────────────────────────────────────────
// Tipe hasil parsing
// ─────────────────────────────────────────────────────────────────────────────

export type FileCategory =
  | "image"          // gambar → dikirim via vision pipeline (imageData terisi)
  | "pdf-text"       // PDF dengan teks → dikirim sebagai teks dalam prompt
  | "pdf-scanned"    // PDF scan/gambar → dikirim sebagai PDF raw (Gemini saja)
  | "docx"           // DOCX → teks via mammoth
  | "text"           // TXT / CSV → teks plain
  | "unsupported";   // Tipe tidak didukung → kembalikan error

export interface ParsedFileResult {
  /** Kategori akhir setelah deteksi */
  category: FileCategory;

  /** MIME type original yang diterima dari client */
  originalMimeType: string;

  /** Base64 original yang diterima dari client (tanpa prefix data:...) */
  originalBase64: string;

  /**
   * Untuk category = "image" atau "pdf-scanned".
   * Berisi data yang siap dikirim ke provider via vision pipeline.
   * Untuk image → sudah dikonversi ke WebP.
   * Untuk pdf-scanned → base64 PDF original (Gemini mendukung application/pdf).
   */
  imageData?: {
    mimeType: string;
    base64Data: string;
  };

  /**
   * Untuk category = "pdf-text" | "docx" | "text".
   * Teks yang diekstrak, siap diinjek ke prompt.
   */
  extractedText?: string;

  /**
   * Pesan error jika category = "unsupported".
   * Langsung bisa dipakai sebagai body response 400.
   */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batas ukuran file
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

// Ambang batas karakter agar dianggap PDF teks-native (bukan gambar)
const PDF_TEXT_MIN_CHARS = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: parse data URL atau raw base64
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedBase64 {
  mimeType: string;
  base64Data: string;
}

export function parseBase64Input(raw: string, fallbackMime = "image/jpeg"): ParsedBase64 {
  if (raw.startsWith("data:")) {
    const m = raw.match(/^data:([a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*);base64,(.+)$/);
    if (m) {
      return { mimeType: m[1], base64Data: m[2] };
    }
  }
  return { mimeType: fallbackMime, base64Data: raw };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fungsi utama: parseUploadedFile
// ─────────────────────────────────────────────────────────────────────────────

export async function parseUploadedFile(rawInput: string): Promise<ParsedFileResult> {
  const { mimeType, base64Data } = parseBase64Input(rawInput);

  // ── Validasi ukuran ────────────────────────────────────────────────────────
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return {
      category: "unsupported",
      originalMimeType: mimeType,
      originalBase64: base64Data,
      error: `Ukuran file melebihi batas 2MB (diterima: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Harap kompres file terlebih dahulu.`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. GAMBAR (image/*)
  // ─────────────────────────────────────────────────────────────────────────
  if (mimeType.startsWith("image/")) {
    try {
      const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
      return {
        category: "image",
        originalMimeType: mimeType,
        originalBase64: base64Data,
        imageData: {
          mimeType: "image/webp",
          base64Data: webpBuffer.toString("base64")
        }
      };
    } catch (err: any) {
      return {
        category: "unsupported",
        originalMimeType: mimeType,
        originalBase64: base64Data,
        error: `Gagal memproses gambar: ${err.message}`
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. PDF
  // ─────────────────────────────────────────────────────────────────────────
  if (mimeType === "application/pdf") {
    try {
      // pdf-parse v1: module adalah fungsi langsung yang menerima Buffer
      const pdfParse = require("pdf-parse");
      const pdfResult = await pdfParse(buffer);

      const text = (pdfResult.text || "").trim();

      if (text.length >= PDF_TEXT_MIN_CHARS) {
        // PDF teks-native
        return {
          category: "pdf-text",
          originalMimeType: mimeType,
          originalBase64: base64Data,
          extractedText: text
        };
      } else {
        // PDF scan/gambar — kirim raw PDF ke Gemini (yang mendukung application/pdf)
        return {
          category: "pdf-scanned",
          originalMimeType: mimeType,
          originalBase64: base64Data,
          imageData: {
            mimeType: "application/pdf",
            base64Data: base64Data
          }
        };
      }
    } catch (err: any) {
      // Jika pdf-parse error (mis. PDF terenkripsi), perlakukan sebagai scanned
      console.warn("[file-parser] pdf-parse error, treating as scanned PDF:", err.message);
      return {
        category: "pdf-scanned",
        originalMimeType: mimeType,
        originalBase64: base64Data,
        imageData: {
          mimeType: "application/pdf",
          base64Data: base64Data
        }
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. DOCX
  // ─────────────────────────────────────────────────────────────────────────
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/docx";

  if (isDocx) {
    try {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();

      return {
        category: "docx",
        originalMimeType: mimeType,
        originalBase64: base64Data,
        extractedText: text || "(Dokumen DOCX kosong atau tidak dapat diekstrak)"
      };
    } catch (err: any) {
      return {
        category: "unsupported",
        originalMimeType: mimeType,
        originalBase64: base64Data,
        error: `Gagal membaca file DOCX: ${err.message}`
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. CSV / TXT (teks biasa)
  // ─────────────────────────────────────────────────────────────────────────
  if (
    mimeType === "text/csv" ||
    mimeType === "text/plain" ||
    mimeType === "text/tab-separated-values" ||
    mimeType === "application/csv"
  ) {
    const text = buffer.toString("utf-8").trim();
    return {
      category: "text",
      originalMimeType: mimeType,
      originalBase64: base64Data,
      extractedText: text || "(File teks kosong)"
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Tipe tidak dikenal
  // ─────────────────────────────────────────────────────────────────────────
  return {
    category: "unsupported",
    originalMimeType: mimeType,
    originalBase64: base64Data,
    error: `Tipe file tidak didukung: ${mimeType}. Format yang didukung: JPG, PNG, HEIC, PDF, DOCX, CSV, TXT.`
  };
}
