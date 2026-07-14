import { Sun, Moon, Globe, ShieldCheck, Search, Activity } from "lucide-react";
import { ViewType, Language } from "../types";
import { translations } from "../i18n";

interface NavbarProps {
  activeTab: ViewType;
  lang: Language;
  setLang: (lang: Language) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export default function Navbar({ activeTab, lang, setLang, theme, setTheme }: NavbarProps) {
  const t = translations[lang];

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview': return t.navOverview;
      case 'apps': return t.navApps;
      case 'knowledge': return t.navKnowledge;
      case 'usage': return t.navUsage;
      case 'settings': return t.navSettings;
      default: return "";
    }
  };

  return (
    <header className="h-16 border-b border-bento-border px-8 flex items-center justify-between shrink-0 transition-colors duration-300 bg-bento-bg text-bento-text-primary">
      {/* Current View Title */}
      <div className="flex items-center gap-3">
        <h2 className="font-semibold text-lg tracking-tight" id="navbar-view-title">{getTabTitle()}</h2>
        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1 bg-bento-success/10 text-bento-success border border-bento-success/10 animate-fade-in" id="gateway-status">
          <span className="w-1.5 h-1.5 rounded-full bg-bento-success animate-pulse shrink-0" />
          <span>Gateway Active</span>
        </span>
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-4">
        {/* Search Bar Placeholder */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-bento-text-secondary opacity-60" />
          <input
            type="text"
            placeholder={t.search}
            id="navbar-search"
            disabled
            className="pl-9 pr-4 py-1.5 text-xs rounded-xl w-60 border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none transition-all placeholder:text-bento-text-secondary/60"
          />
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-bento-border bg-bento-surface-lighter">
          <button
            onClick={() => setLang('id')}
            id="lang-btn-id"
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
              lang === 'id'
                ? 'bg-bento-accent text-white shadow-xs'
                : 'text-bento-text-secondary hover:text-bento-text-primary'
            }`}
          >
            ID
          </button>
          <button
            onClick={() => setLang('en')}
            id="lang-btn-en"
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
              lang === 'en'
                ? 'bg-bento-accent text-white shadow-xs'
                : 'text-bento-text-secondary hover:text-bento-text-primary'
            }`}
          >
            EN
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          id="theme-toggle-btn"
          className="p-2 rounded-xl border border-bento-border bg-bento-surface text-bento-accent hover:bg-bento-surface-lighter transition-all duration-150"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
