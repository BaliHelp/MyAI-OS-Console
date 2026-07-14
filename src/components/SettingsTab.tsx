import { useState, FormEvent } from "react";
import { User, ShieldCheck, Sun, Moon, Globe, Code, Sliders, ExternalLink, Activity } from "lucide-react";
import { Language } from "../types";
import { translations } from "../i18n";

interface SettingsTabProps {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  adminEmail: string;
}

export default function SettingsTab({ lang, setLang, theme, setTheme, adminEmail }: SettingsTabProps) {
  const t = translations[lang];

  // Owner profile simple fields
  const [ownerName, setOwnerName] = useState("Ahmad Fauzi");
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  return (
    <div className="space-y-8 animate-fade-in" id="settings-tab">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold tracking-tight mb-1" id="settings-tab-header">{t.settingsTitle}</h3>
        <p className="text-sm text-gray-500">{t.settingsSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card & Preferences Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Owner Profile Card */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="owner-profile-card">
            <div className="flex items-center gap-2.5 mb-6">
              <User className="h-5 w-5 text-bento-accent" />
              <h4 className="font-bold text-base tracking-tight text-bento-text-primary">{t.profileTitle}</h4>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-bento-text-secondary">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    id="profile-name-input"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-bento-text-secondary">Email Administrator</label>
                  <input
                    type="email"
                    disabled
                    value={adminEmail}
                    id="profile-email-input"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-secondary/60 cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-bento-border">
                <span className="text-[10px] text-bento-text-secondary font-mono">Role: Primary Ecosystem Owner</span>
                <button
                  type="submit"
                  id="save-profile-settings-btn"
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl text-white transition-all duration-150 ${
                    profileSaved 
                      ? 'bg-bento-success' 
                      : 'bg-bento-accent hover:bg-bento-accent/90 shadow-xs'
                  }`}
                >
                  {profileSaved ? "Tersimpan!" : t.save}
                </button>
              </div>
            </form>
          </div>

          {/* Core Preferences Card (Theme & Lang) */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="core-preferences-card">
            <div className="flex items-center gap-2.5 mb-6">
              <Sliders className="h-5 w-5 text-bento-accent" />
              <h4 className="font-bold text-base tracking-tight text-bento-text-primary">{t.appearanceTitle}</h4>
            </div>

            <div className="space-y-6">
              {/* Theme Settings row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-bento-border">
                <div>
                  <h5 className="font-semibold text-sm mb-1 text-bento-text-primary">{t.themeLabel}</h5>
                  <p className="text-xs text-bento-text-secondary">Sesuaikan pencahayaan panel konsol untuk kenyamanan mata.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    id="theme-select-dark"
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      theme === 'dark'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    id="theme-select-light"
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      theme === 'light'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </button>
                </div>
              </div>

              {/* Language Settings row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
                <div>
                  <h5 className="font-semibold text-sm mb-1 text-bento-text-primary">{t.langLabel}</h5>
                  <p className="text-xs text-bento-text-secondary">Ubah bahasa default yang ditampilkan pada semua label konsol.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLang('id')}
                    id="lang-select-id"
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      lang === 'id'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    Bahasa Indonesia
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    id="lang-select-en"
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      lang === 'en'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Coming Soon / Future public devs */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface relative overflow-hidden h-full flex flex-col justify-between" id="community-settings-card">
            
            {/* Watermark Pattern */}
            <div className="absolute right-[-20px] top-[-20px] opacity-5 rotate-12 pointer-events-none">
              <Code className="h-40 w-40 text-bento-text-secondary" />
            </div>

            <div className="relative space-y-4">
              <span className="px-2.5 py-0.5 text-[9px] font-extrabold rounded-full bg-bento-accent/15 text-bento-accent uppercase tracking-wider border border-bento-accent/10">
                Coming Soon
              </span>

              <div>
                <h4 className="font-bold text-base mb-1 text-bento-text-primary" id="community-settings-title">{t.placeholderSettingsTitle}</h4>
                <p className="text-xs text-bento-text-secondary leading-relaxed">{t.placeholderSettingsDesc}</p>
              </div>

              <div className="pt-4 border-t border-bento-border space-y-3 text-xs text-bento-text-secondary">
                <div className="flex items-center justify-between hover:text-bento-text-primary transition-colors duration-150 cursor-pointer">
                  <span>Public Registration URL</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Developer Sign-up Moderation</span>
                  <span className="font-mono text-[11px] bg-bento-surface-lighter px-2 py-0.5 rounded border border-bento-border">Disabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Client-key Sandbox Mode</span>
                  <span className="font-mono text-[11px] bg-bento-surface-lighter px-2 py-0.5 rounded border border-bento-border">Inactive</span>
                </div>
              </div>
            </div>

            <div className="pt-6 relative">
              <button
                disabled
                className="w-full py-2.5 text-xs font-bold rounded-xl border border-dashed border-bento-border text-bento-text-secondary/50 bg-bento-surface-lighter cursor-not-allowed"
              >
                Configure Community Tier
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
