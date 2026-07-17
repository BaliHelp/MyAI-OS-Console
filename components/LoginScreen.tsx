'use client';

import { useState, FormEvent } from "react";
import { Code, Mail, Lock, Globe, KeyRound, Eye, EyeOff, UserPlus, BookOpen, Code2, Layers, FileText } from "lucide-react";
import { Language } from "@/lib/types";
import { translations } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);

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

  const devResources = [
    { icon: BookOpen, label: lang === 'id' ? "Dokumentasi" : "Documentation", href: "/docs" },
    { icon: Code2,    label: lang === 'id' ? "Referensi API" : "API Reference", href: "/api-reference" },
    { icon: Layers,   label: lang === 'id' ? "Contoh Starter" : "Starter Examples", href: "/examples" },
    { icon: FileText, label: lang === 'id' ? "Panduan" : "Guides", href: "/guides" },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 transition-colors duration-200 relative overflow-hidden bg-[#060709] text-white">
      
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#5B8DEF]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#2DD4BF]/5 blur-3xl pointer-events-none" />

      {/* Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <Globe className="h-4 w-4 opacity-50" />
        <button
          onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
          id="login-lang-toggle"
          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#1D1E22] bg-[#111214] text-[#9CA3AF] hover:text-white"
        >
          {lang === 'id' ? "English" : "Bahasa Indonesia"}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10" id="login-container">

        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 bg-[#111215] border border-[#1D1E22] overflow-hidden p-1 bg-gradient-to-br from-[#1A1C20] to-[#111215]">
            <img src="/Favicon.webp" alt="Logo" className="h-full w-full object-contain" />
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
              {mode === 'forgot' && "Lupa Password"}
            </h2>
            <p className="text-xs text-gray-500">
              {mode === 'login' && t.loginSubtitle}
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
                  "Reset Sandi"
                )}
              </button>

              {/* Google SSO — UI only, OAuth logic pending */}
              {mode === 'login' && (
                <button
                  type="button"
                  id="google-sso-btn"
                  disabled
                  title="Google Sign-In — coming soon"
                  className="w-full py-2.5 rounded-xl font-bold text-sm border border-[#25262B] bg-[#1C1E24] text-gray-400 flex items-center justify-center gap-2 cursor-not-allowed opacity-50"
                  onClick={() => {
                    // TODO: Integrate Google OAuth via NextAuth or Supabase Auth
                    // Requires: Google Console OAuth2 credentials configured in environment
                    // NEXT_PUBLIC_GOOGLE_CLIENT_ID + callback URL setup
                  }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google <span className="text-[10px] ml-1">(Segera Hadir)</span>
                </button>
              )}

              {mode === 'forgot' && (
                <div className="flex justify-center text-xs text-gray-400 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError("");
                      setInfoMessage("");
                    }}
                    className="text-[#5B8DEF] font-bold hover:underline"
                  >
                    Kembali ke Login
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Developer Resources Grid */}
        <div className="grid grid-cols-4 gap-2" id="dev-resources-grid">
          {devResources.map(resource => {
            const Icon = resource.icon;
            return (
              <Link
                key={resource.label}
                href={resource.href}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-[#1D1E22] bg-[#111214] hover:bg-[#16181C] hover:border-[#5B8DEF]/30 transition-all duration-150 text-center"
              >
                <Icon className="h-4 w-4 text-gray-400" />
                <span className="text-[9px] font-semibold text-gray-400 leading-tight">{resource.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Security note */}
        <div className="text-center text-[10px] text-gray-500 flex items-center justify-center gap-1.5">
          <KeyRound className="h-3 w-3" />
          <span>Sistem Gateway dilindungi enkripsi JWT Session & Bcrypt.</span>
        </div>

        {/* Legal Footer */}
        <div className="text-center text-[10px] text-gray-600 flex items-center justify-center gap-3">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">
            Syarat Penggunaan
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">
            Kebijakan Privasi
          </Link>
          <span>•</span>
          <span>© 2026 MyAI OS™ All Rights Reserved</span>
        </div>
      </div>
    </div>
  );
}
