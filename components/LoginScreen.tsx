'use client';

import { useState, FormEvent } from "react";
import { Code, Mail, Lock, Globe, KeyRound, Eye, EyeOff, UserPlus, HelpCircle } from "lucide-react";
import { Language } from "@/lib/types";
import { translations } from "@/lib/i18n";
import { useRouter } from "next/navigation";

export default function LoginScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>('id');
  const t = translations[lang];

  // Forms
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Peek Credentials State
  const [peekCredentials, setPeekCredentials] = useState<{ email: string; val: string } | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Peek Credentials Function
  const handlePeek = async () => {
    if (peekCredentials) {
      setPeekCredentials(null);
      return;
    }
    setPeeking(true);
    try {
      const res = await fetch("/api/auth/peek");
      if (res.ok) {
        const data = await res.json();
        setPeekCredentials({ email: data.email, val: data.password });
      }
    } catch {
      setError("Gagal mengintip kredensial.");
    } finally {
      setPeeking(false);
    }
  };

  // Submit Handler for all modes
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setError(data.error || t.loginError);
        }
      } else if (mode === 'register') {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setInfoMessage("Registrasi berhasil! Silakan masuk dengan akun baru Anda.");
          setMode('login');
        } else {
          setError(data.error || "Gagal membuat akun.");
        }
      } else if (mode === 'forgot') {
        const response = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setInfoMessage(data.message || "Password berhasil direset.");
          setMode('login');
        } else {
          setError(data.error || "Gagal memproses reset sandi.");
        }
      }
    } catch {
      setError("Kesalahan koneksi server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 transition-colors duration-200 relative overflow-hidden bg-[#060709] text-white">
      
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#5B8DEF]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#2DD4BF]/5 blur-3xl pointer-events-none" />

      {/* Language Toggle & Peek Credentials CTA */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={handlePeek}
          disabled={peeking}
          id="peek-credentials-btn"
          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-bento-accent-muted bg-bento-accent/10 text-bento-accent hover:bg-bento-accent/20 transition-all flex items-center gap-1.5"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>{peekCredentials ? "Tutup Kredensial" : "Intip Kredensial .env"}</span>
        </button>

        <Globe className="h-4 w-4 opacity-50 ml-2" />
        <button
          onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
          id="login-lang-toggle"
          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#1D1E22] bg-[#111214] text-[#9CA3AF] hover:text-white"
        >
          {lang === 'id' ? "English" : "Bahasa Indonesia"}
        </button>
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10" id="login-container">
        
        {/* Peek Credentials Banner */}
        {peekCredentials && (
          <div className="p-4 rounded-2xl border border-bento-accent/30 bg-bento-accent/10 text-xs space-y-2 animate-fade-in">
            <h4 className="font-bold flex items-center gap-1 text-bento-accent">
              🔑 Kredensial yang Terdeteksi di .env.local
            </h4>
            <div className="font-mono space-y-1">
              <div>Email: <span className="text-gray-200 select-all font-semibold">{peekCredentials.email}</span></div>
              <div>Sandi: <span className="text-gray-200 select-all font-semibold">{peekCredentials.val}</span></div>
            </div>
            <p className="text-[10px] text-gray-400">
              * Sandi di atas dicocokkan otomatis menggunakan kecocokan teks langsung atau enkripsi bcrypt.
            </p>
          </div>
        )}

        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 bg-[#5B8DEF]/10 text-[#5B8DEF]">
            <Code className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{t.appName}</h1>
            <p className="text-xs font-semibold tracking-widest uppercase opacity-60 font-mono">Ecosystem Control Panel</p>
          </div>
          <div className="max-w-xs mx-auto">
            <p className="text-xs text-gray-400 font-medium leading-relaxed">{t.tagline}</p>
          </div>
        </div>

        {/* Login/Register/Forgot Card */}
        <div className="p-8 rounded-3xl border bg-[#111215] border-[#1D1E22]" id="login-card">
          <div className="mb-6">
            <h2 className="text-base font-bold tracking-tight mb-1" id="login-card-title">
              {mode === 'login' && t.loginTitle}
              {mode === 'register' && "Buat Akun Administrator"}
              {mode === 'forgot' && "Lupa Password"}
            </h2>
            <p className="text-xs text-gray-500">
              {mode === 'login' && t.loginSubtitle}
              {mode === 'register' && "Daftarkan akun administrator baru di Supabase ekosistem."}
              {mode === 'forgot' && "Reset password administrator ke sandi default ekosistem."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                <span>⚠️ {error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                <span>📩 {infoMessage}</span>
              </div>
            )}

            {/* Email Field (all modes) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-500 opacity-60" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-1 bg-[#1C1E24] border-[#25262B] text-white focus:ring-[#5B8DEF]"
                />
              </div>
            </div>

            {/* Password Field (login & register only) */}
            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[10px] text-[#5B8DEF] hover:underline"
                    >
                      Lupa Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-500 opacity-60" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className="w-full pl-10 pr-12 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-1 bg-[#1C1E24] border-[#25262B] text-white focus:ring-[#5B8DEF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all duration-150 bg-[#5B8DEF] hover:bg-[#497BE0] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? t.loading : (
                  mode === 'login' ? t.loginBtn :
                  mode === 'register' ? "Daftar Administrator" :
                  "Reset Sandi"
                )}
              </button>

              <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
                {mode === 'login' ? (
                  <>
                    <span>Belum ada akun di Supabase?</span>
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="text-[#5B8DEF] font-bold hover:underline flex items-center gap-1"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Buat Akun
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError("");
                      setInfoMessage("");
                    }}
                    className="text-[#5B8DEF] font-bold hover:underline mx-auto"
                  >
                    Kembali ke Login
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Security note */}
        <div className="text-center text-[10px] text-gray-500 flex items-center justify-center gap-1.5">
          <KeyRound className="h-3 w-3" />
          <span>Sistem Gateway dilindungi enkripsi JWT Session & Bcrypt.</span>
        </div>
      </div>
    </div>
  );
}
