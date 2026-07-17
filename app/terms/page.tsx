import type { Metadata } from "next";
import Link from "next/link";
import { Code, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Syarat Penggunaan — MyAI OS Console",
  description: "Syarat dan ketentuan penggunaan MyAI OS Console, infrastruktur internal MyBusiness.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#060709] text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-[#5B8DEF]/10 text-[#5B8DEF]">
            <Code className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Syarat Penggunaan</h1>
            <p className="text-xs text-gray-400">MyAI OS Console — Infrastruktur Internal MyBusiness</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 mb-8 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            <strong>Penggunaan Internal Saja.</strong> MyAI OS Console adalah sistem infrastruktur <em>internal</em> untuk ekosistem MyBusiness.
            Sistem ini <strong>bukan produk publik</strong> dan tidak dimaksudkan untuk diakses oleh pihak luar tanpa otorisasi eksplisit dari pemilik ekosistem.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-gray-300">
          <section>
            <h2 className="text-base font-bold text-white mb-3">1. Definisi</h2>
            <p>
              "MyAI OS Console" (selanjutnya disebut "Konsol") adalah panel administrasi internal yang dirancang untuk mengelola API gateway,
              konfigurasi AI, basis pengetahuan, dan data operasional ekosistem produk MyBusiness,
              termasuk namun tidak terbatas pada: Indonesian Visas, Tropic Tech, dan produk lainnya di bawah naungan MyBusiness.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">2. Akses & Otorisasi</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Hanya administrator yang diberi otorisasi oleh pemilik ekosistem yang berhak mengakses Konsol ini.</li>
              <li>Berbagi kredensial akses dengan pihak ketiga tanpa izin eksplisit dari pemilik adalah pelanggaran serius.</li>
              <li>Pemilik berhak mencabut akses sewaktu-waktu tanpa pemberitahuan sebelumnya.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">3. Tanggung Jawab Pengguna</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Menjaga kerahasiaan kredensial admin, API key, dan encryption secret.</li>
              <li>Tidak mengekspos nilai credential apapun dalam laporan, log, screenshot, atau komunikasi yang tidak terenkripsi.</li>
              <li>Melaporkan segera kepada pemilik ekosistem jika terdapat indikasi akses tidak sah.</li>
              <li>Tidak menggunakan infrastruktur ini untuk aktivitas di luar lingkup operasional MyBusiness.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">4. Batasan Layanan</h2>
            <p>
              Konsol ini disediakan "sebagaimana adanya" (as-is) untuk keperluan internal. Pemilik ekosistem tidak memberikan
              jaminan atas ketersediaan, akurasi, atau kesesuaian untuk tujuan tertentu di luar lingkup yang ditetapkan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">5. Kerahasiaan Data</h2>
            <p>
              Data yang diproses melalui Konsol — termasuk log penggunaan, data klien, dokumen pengetahuan, dan konfigurasi provider —
              bersifat rahasia dan milik ekosistem MyBusiness. Penggunaan data ini di luar konteks operasional internal dilarang.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">6. Perubahan Ketentuan</h2>
            <p>
              Pemilik ekosistem berhak memperbarui syarat ini sewaktu-waktu. Versi terbaru selalu tersedia di halaman ini.
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
          <Link href="/privacy" className="text-gray-400 hover:text-gray-200">Kebijakan Privasi →</Link>
        </div>
      </div>
    </div>
  );
}
