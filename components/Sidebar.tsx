'use client';

import { useState } from "react";
import { LayoutDashboard, AppWindow, Database, BarChart3, Settings, LogOut, Code, ChevronLeft, ChevronRight, Route, Sparkles, Server, Bot, DollarSign, ShieldCheck, Activity } from "lucide-react";
import { ViewType, Language } from "@/lib/types";
import { translations } from "@/lib/i18n";
import { useRouter } from "next/navigation";

interface SidebarProps {
  activeTab: ViewType;
  setActiveTab: (tab: ViewType) => void;
  lang: Language;
  theme: 'dark' | 'light';
  adminEmail: string;
}

export default function Sidebar({ activeTab, setActiveTab, lang, theme, adminEmail }: SidebarProps) {
  const t = translations[lang] as any;
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'overview' as ViewType, label: t.navOverview, icon: LayoutDashboard },
    { id: 'apps' as ViewType, label: t.navApps, icon: AppWindow },
    { id: 'knowledge' as ViewType, label: t.navKnowledge, icon: Database },
    { id: 'datacenter' as ViewType, label: t.navDataCenter || "Data Center", icon: Server },
    { id: 'routing' as ViewType, label: t.navRouting || "Job Routing", icon: Route },
    { id: 'specs' as ViewType,     label: t.navSpecs     || "Job Specs",  icon: Sparkles },
    { id: 'personas' as ViewType,  label: "Personas",                     icon: Bot },
    { id: 'usage' as ViewType,     label: t.navUsage,                     icon: BarChart3 },
    { id: 'costs' as ViewType,     label: t.navCosts     || "Estimasi Biaya", icon: DollarSign },
    { id: 'auditlog' as ViewType,  label: t.navAuditLog  || "Audit Log",    icon: ShieldCheck },
    { id: 'health' as ViewType,    label: t.navHealth    || "Kesehatan",    icon: Activity },
    { id: 'settings' as ViewType, label: t.navSettings, icon: Settings },
  ];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className={`flex flex-col h-screen border-r border-bento-border shrink-0 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    } ${theme === 'dark' ? 'bg-[#0F1012]' : 'bg-[#F9FAFB]'}`}>
      
      {/* Brand Header */}
      <div className={`p-4 border-b border-bento-border flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="h-9 w-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-bento-surface border border-bento-border/50 p-0.5">
          <img src="/Favicon.webp" alt="Logo" className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-base tracking-tight truncate" id="sidebar-app-title">MyAI OS</h1>
            <p className="text-[10px] font-medium tracking-widest uppercase opacity-60 text-bento-text-secondary">Ecosystem Console</p>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-4'}`} id="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              id={`nav-btn-${item.id}`}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 group ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-bento-accent-muted text-bento-accent font-semibold'
                  : 'text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                isActive ? 'text-bento-accent' : 'opacity-70 group-hover:opacity-100'
              }`} />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-bento-accent" />}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: Admin info + Logout */}
      <div className={`p-3 border-t border-bento-border flex flex-col gap-2`}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-bento-accent to-bento-success flex items-center justify-center text-white font-semibold text-xs shrink-0 select-none">
              {adminEmail ? adminEmail.substring(0, 2).toUpperCase() : "AD"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate leading-none mb-1 text-bento-text-primary">Founder / Owner</p>
              <p className="text-[10px] text-bento-text-secondary truncate opacity-80">{adminEmail}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          id="logout-btn"
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all duration-150`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t.logout}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          id="sidebar-collapse-btn"
          className="w-full flex items-center justify-center py-2 rounded-xl text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter transition-all duration-150"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
