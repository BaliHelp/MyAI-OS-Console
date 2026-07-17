import type { Metadata } from "next";
import Link from "next/link";
import { Code, Eye } from "lucide-react";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — MyAI OS Console",
  description: "Kebijakan privasi dan perlindungan data MyAI OS Console, infrastruktur internal MyBusiness.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#060709] text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-[#5B8DEF]/10 text-[#5B8DEF]">
            <Code className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kebijakan Privasi</h1>
            <p className="text-xs text-gray-400">MyAI OS Console — Infrastruktur Internal MyBusiness</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 mb-8 flex items-start gap-3">
          <Eye className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200">
            Dokumen ini menjelaskan jenis data yang dikumpulkan, cara penggunaannya, dan komitmen perlindungan data
            dalam operasional <strong>internal</strong> MyAI OS Console.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-gray-300">
          <section>
            <h2 className="text-base font-bold text-white mb-3">1. Data yang Dikumpulkan</h2>
            <p className="mb-3">Dalam operasional normalnya, MyAI OS Console mencatat:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Log penggunaan AI</strong>: provider, jumlah token, latency, field key — tanpa menyimpan konten percakapan secara default.</li>
              <li><strong>Data Center</strong>: dokumen terunggah (OCR), interaksi chatbot (prompt tertruncate + snippet respons maks 500/1000 karakter).</li>
              <li><strong>Audit log</strong>: waktu, aksi admin, dan metadata — tanpa nilai secret/credential apapun.</li>
              <li><strong>Profil bisnis dan basis pengetahuan</strong>: konten yang dimasukkan secara manual oleh administrator.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">2. Data yang TIDAK Disimpan</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Nilai raw API key provider (disimpan terenkripsi dengan AES-256).</li>
              <li>Nilai session secret, encryption secret, atau password dalam bentuk plaintext.</li>
              <li>Konten percakapan lengkap di log usage (hanya statistik token).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">3. Penyimpanan & Keamanan</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Semua data disimpan di Supabase (PostgreSQL) dengan Row-Level Security (RLS) aktif.</li>
              <li>Provider API key dienkripsi dengan AES-256-GCM sebelum disimpan.</li>
              <li>Akses ke database hanya melalui service role key yang tersimpan di environment variable server.</li>
              <li>Session autentikasi menggunakan httpOnly cookie dengan JWT yang ditandatangani.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">4. Akses Data</h2>
            <p>
              Data hanya dapat diakses oleh administrator yang terotorisasi melalui Konsol ini.
              Tidak ada API publik yang mengekspos data internal ke luar tanpa autentikasi.
              Semua endpoint sensitif dilindungi oleh middleware autentikasi.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">5. Retensi Data</h2>
            <p>
              Data dipertahankan selama diperlukan untuk operasional bisnis. Administrator dapat menghapus data
              melalui panel Konsol. Log audit dipertahankan sebagai catatan historis dan tidak dapat dihapus
              secara individual melalui antarmuka UI.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">6. Keterbukaan</h2>
            <p>
              Kebijakan ini berlaku untuk penggunaan internal ekosistem MyBusiness.
              Produk-produk yang menggunakan AI Gateway (Indonesian Visas, Tropic Tech, dll.)
              mungkin memiliki kebijakan privasi tersendiri yang berlaku untuk pengguna akhirnya.
            </p>
          </section>

          <div className="pt-4 border-t border-[#1D1E22]">
            <p className="text-xs text-gray-500">
              Terakhir diperbarui: Juli 2026 • MyAI OS™ — Internal Use Only
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4 text-xs">
          <Link href="/login" className="text-[#5B8DEF] hover:underline">← Kembali ke Login</Link>
          <Link href="/terms" className="text-gray-400 hover:text-gray-200">Syarat Penggunaan →</Link>
        </div>
      </div>
    </div>
  );
}
