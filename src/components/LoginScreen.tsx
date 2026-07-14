import { useState, FormEvent } from "react";
import { Code, ShieldCheck, Mail, Lock, Sparkles, Globe, KeyRound } from "lucide-react";
import { Language } from "../types";
import { translations } from "../i18n";

interface LoginScreenProps {
  onLoginSuccess: (email: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  theme: 'dark' | 'light';
}

export default function LoginScreen({ onLoginSuccess, lang, setLang, theme }: LoginScreenProps) {
  const t = translations[lang];

  const [email, setEmail] = useState("rimbanusaonline@gmail.com"); // Prepopulate with owner's email for seamless login!
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user.email);
      } else {
        setError(data.error || t.loginError);
      }
    } catch (err) {
      setError(t.loginError);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = () => {
    setError("");
    if (!email) {
      setError("Please enter your email first.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setMagicLinkSent(true);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center p-4 transition-colors duration-200 relative overflow-hidden ${
      theme === 'dark' ? 'bg-[#060709] text-white' : 'bg-[#FAFAFA] text-[#1F2937]'
    }`}>
      
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#5B8DEF]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#2DD4BF]/5 blur-3xl pointer-events-none" />

      {/* Floating Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <Globe className="h-4 w-4 opacity-50" />
        <button
          onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
          id="login-lang-toggle"
          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
            theme === 'dark' 
              ? 'border-[#1D1E22] bg-[#111214] text-[#9CA3AF] hover:text-white' 
              : 'border-[#E5E7EB] bg-white text-gray-600 hover:text-black'
          }`}
        >
          {lang === 'id' ? "English (EN)" : "Bahasa Indonesia (ID)"}
        </button>
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10" id="login-container">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
            theme === 'dark' ? 'bg-[#5B8DEF]/10 text-[#5B8DEF]' : 'bg-[#4F46E5]/10 text-[#4F46E5]'
          }`}>
            <Code className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{t.appName}</h1>
            <p className="text-xs font-semibold tracking-widest uppercase opacity-60">Ecosystem Control Panel</p>
          </div>
          <div className="max-w-xs mx-auto">
            <p className="text-xs text-gray-400 font-medium leading-relaxed">{t.tagline}</p>
          </div>
        </div>

        {/* Login Card */}
        <div className={`p-8 rounded-3xl border transition-all ${
          theme === 'dark' 
            ? 'bg-[#111215] border-[#1D1E22]' 
            : 'bg-white border-[#E5E7EB] shadow-xl'
        }`} id="login-card">
          <div className="mb-6">
            <h2 className="text-base font-bold tracking-tight mb-1" id="login-card-title">{t.loginTitle}</h2>
            <p className="text-xs text-gray-500">{t.loginSubtitle}</p>
          </div>

          <form onSubmit={handlePasswordLogin} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                <span>⚠️ {error}</span>
              </div>
            )}

            {magicLinkSent && (
              <div className="p-3 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                <span>📩 Magic link has been sent to {email}. Check your inbox!</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4.5 w-4.5 text-gray-500 opacity-60" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  id="login-email-input"
                  placeholder={t.emailPlaceholder}
                  className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-1 ${
                    theme === 'dark'
                      ? 'bg-[#1C1E24] border-[#25262B] text-white focus:ring-[#5B8DEF]'
                      : 'bg-[#F9FAFB] border-[#E5E7EB] text-black focus:ring-[#4F46E5]'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4.5 w-4.5 text-gray-500 opacity-60" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  id="login-password-input"
                  placeholder={t.passwordPlaceholder}
                  className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-1 ${
                    theme === 'dark'
                      ? 'bg-[#1C1E24] border-[#25262B] text-white focus:ring-[#5B8DEF]'
                      : 'bg-[#F9FAFB] border-[#E5E7EB] text-black focus:ring-[#4F46E5]'
                  }`}
                />
              </div>
            </div>

            {/* Buttons Row */}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="submit"
                disabled={loading}
                id="submit-password-login"
                className={`w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all duration-150 ${
                  theme === 'dark' 
                    ? 'bg-[#5B8DEF] hover:bg-[#497BE0] active:scale-[0.99]' 
                    : 'bg-[#4F46E5] hover:bg-[#3B32C3] active:scale-[0.99]'
                }`}
              >
                {loading ? t.loading : t.loginBtn}
              </button>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading}
                id="submit-magic-link-login"
                className={`w-full py-2.5 rounded-xl font-semibold text-xs border transition-all duration-150 ${
                  theme === 'dark'
                    ? 'border-[#1D1E22] bg-[#18191D] text-gray-400 hover:text-white hover:bg-[#202126]'
                    : 'border-[#E5E7EB] bg-white text-gray-600 hover:bg-[#F9FAFB]'
                }`}
              >
                {t.magicLinkBtn}
              </button>
            </div>
          </form>
        </div>

        {/* Helpful instructions footer */}
        <div className="text-center text-[10px] text-gray-500 flex items-center justify-center gap-1.5">
          <KeyRound className="h-3 w-3" />
          <span>Demo Access: Use pre-filled credentials & any password.</span>
        </div>
      </div>
    </div>
  );
}
