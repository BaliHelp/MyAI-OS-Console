import { LayoutDashboard, AppWindow, Database, BarChart3, Settings, LogOut, Code, Menu, X } from "lucide-react";
import { ViewType, Language } from "../types";
import { translations } from "../i18n";

interface SidebarProps {
  activeTab: ViewType;
  setActiveTab: (tab: ViewType) => void;
  lang: Language;
  theme: 'dark' | 'light';
  onLogout: () => void;
  adminEmail: string;
}

export default function Sidebar({ activeTab, setActiveTab, lang, theme, onLogout, adminEmail }: SidebarProps) {
  const t = translations[lang];

  const menuItems = [
    { id: 'overview' as ViewType, label: t.navOverview, icon: LayoutDashboard },
    { id: 'apps' as ViewType, label: t.navApps, icon: AppWindow },
    { id: 'knowledge' as ViewType, label: t.navKnowledge, icon: Database },
    { id: 'usage' as ViewType, label: t.navUsage, icon: BarChart3 },
    { id: 'settings' as ViewType, label: t.navSettings, icon: Settings },
  ];

  return (
    <aside className={`w-64 flex flex-col h-screen border-r border-bento-border shrink-0 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#0F1012]' : 'bg-[#F9FAFB]'
    }`}>
      {/* Brand Header */}
      <div className="p-6 border-b border-bento-border flex items-center gap-3">
        <div className="p-2 rounded-lg bg-bento-accent-muted text-bento-accent">
          <Code className="h-6 w-6" id="brand-logo-icon" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight" id="sidebar-app-title">MyAI OS</h1>
          <p className="text-[10px] font-medium tracking-widest uppercase opacity-60 text-bento-text-secondary">Ecosystem Console</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto" id="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              id={`nav-btn-${item.id}`}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-bento-accent-muted text-bento-accent font-semibold'
                  : 'text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                isActive 
                  ? 'text-bento-accent' 
                  : 'opacity-70 group-hover:opacity-100'
              }`} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-bento-accent" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin User Info & Logout footer */}
      <div className="p-4 border-t border-bento-border flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-bento-accent to-bento-success flex items-center justify-center text-white font-semibold text-xs shrink-0 select-none">
            {adminEmail ? adminEmail.substring(0, 2).toUpperCase() : "AD"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate leading-none mb-1 text-bento-text-primary">Founder / Owner</p>
            <p className="text-[10px] text-bento-text-secondary truncate opacity-80">{adminEmail}</p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          id="logout-btn"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="h-4 w-4" />
          <span>{t.logout}</span>
        </button>
      </div>
    </aside>
  );
}
