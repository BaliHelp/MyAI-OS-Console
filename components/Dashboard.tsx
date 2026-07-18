'use client';

import { useState, useEffect, useCallback } from "react";
import { ViewType, Language, ClientApp, ApiKey, UsageLog, BusinessProfile, KnowledgeDocument } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import OverviewTab from "@/components/OverviewTab";
import AppsTab from "@/components/AppsTab";
import KnowledgeTab from "@/components/KnowledgeTab";
import UsageTab from "@/components/UsageTab";
import SettingsTab from "@/components/SettingsTab";
import RoutingTab from "@/components/RoutingTab";
import SpecsTab from "@/components/SpecsTab";
import DataCenterTab from "@/components/DataCenterTab";
import PersonasTab from "@/components/PersonasTab";
import CostsTab from "./CostsTab";
import AuditLogTab from "./AuditLogTab";
import HealthTab from "./HealthTab";
import ThreeDLoader from "./ThreeDLoader";
import GlobalLoader from "./GlobalLoader";
import MyAIChatWidget from "./MyAIChatWidget";

interface DashboardProps {
  adminEmail: string;
}

export default function Dashboard({ adminEmail }: DashboardProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<Language>('id');
  const [activeTab, setActiveTab] = useState<ViewType>('overview');

  const [apps, setApps] = useState<ClientApp[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Global fetch activity tracker
  useEffect(() => {
    const originalFetch = window.fetch;
    let activeCount = 0;

    window.fetch = async (...args) => {
      activeCount++;
      setGlobalLoading(true);
      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        activeCount--;
        if (activeCount <= 0) {
          activeCount = 0;
          setGlobalLoading(false);
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Restore theme/lang from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("myai_theme") as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);
    const savedLang = localStorage.getItem("myai_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.backgroundColor = "#0A0B0D";
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = "#FAFAFA";
    }
    localStorage.setItem("myai_theme", theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem("myai_lang", lang); }, [lang]);

  const fetchAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [appsRes, keysRes, logsRes, profileRes, docsRes] = await Promise.all([
        fetch("/api/apps").then((r) => r.json()),
        fetch("/api/keys").then((r) => r.json()),
        fetch("/api/logs").then((r) => r.json()),
        fetch("/api/business-profile").then((r) => r.json()),
        fetch("/api/documents").then((r) => r.json()),
      ]);
      setApps(Array.isArray(appsRes) ? appsRes : []);
      setApiKeys(Array.isArray(keysRes) ? keysRes : []);
      setLogs(Array.isArray(logsRes) ? logsRes : []);
      setBusinessProfile(profileRes);
      setDocuments(Array.isArray(docsRes) ? docsRes : []);
    } catch (e) {
      console.error("Error loading data", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // --- Mutators ---

  const handleCreateApp = async (name: string, slug: string, tier: 'internal' | 'community') => {
    const res = await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, tier }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    await fetchAllData(true);
  };

  const handleGenerateKey = async (clientAppId: string, scope: string[], rateLimit: number | null) => {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_app_id: clientAppId, provider_scope: scope, rate_limit_per_day: rateLimit }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const result = await res.json();
    await fetchAllData(true);
    return result;
  };

  const handleRevokeKey = async (keyId: string) => {
    const res = await fetch(`/api/keys/${keyId}/revoke`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to revoke key");
    await fetchAllData(true);
  };

  const handleSaveProfile = async (content: string) => {
    const res = await fetch("/api/business-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to save profile");
    const updated = await res.json();
    setBusinessProfile(updated);
  };

  const handleAddDocument = async (title: string, content: string, clientAppId: string | null) => {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, client_app_id: clientAppId }),
    });
    if (!res.ok) throw new Error("Failed to add document");
    await fetchAllData(true);
  };

  const handleEditDocument = async (id: string, title: string, content: string, clientAppId: string | null) => {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, client_app_id: clientAppId }),
    });
    if (!res.ok) throw new Error("Failed to update document");
    await fetchAllData(true);
  };

  const handleDeleteDocument = async (id: string) => {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete document");
    await fetchAllData(true);
  };

  if (loading || !businessProfile) {
    return <ThreeDLoader />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bento-bg text-bento-text-primary" id="console-layout">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        theme={theme}
        adminEmail={adminEmail}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar
          activeTab={activeTab}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
        />

        <main className="flex-1 overflow-y-auto p-8 focus:outline-none">
          <div className="max-w-6xl mx-auto pb-12">
            {activeTab === 'overview' && (
              <OverviewTab apps={apps} apiKeys={apiKeys} logs={logs} lang={lang} theme={theme} />
            )}
            {activeTab === 'apps' && (
              <AppsTab
                apps={apps}
                apiKeys={apiKeys}
                logs={logs}
                lang={lang}
                theme={theme}
                onCreateApp={handleCreateApp}
                onGenerateKey={handleGenerateKey}
                onRevokeKey={handleRevokeKey}
              />
            )}
            {activeTab === 'knowledge' && (
              <KnowledgeTab
                apps={apps}
                profile={businessProfile}
                documents={documents}
                lang={lang}
                theme={theme}
                onSaveProfile={handleSaveProfile}
                onAddDocument={handleAddDocument}
                onEditDocument={handleEditDocument}
                onDeleteDocument={handleDeleteDocument}
              />
            )}
            {activeTab === 'usage' && (
              <UsageTab apps={apps} logs={logs} lang={lang} theme={theme} />
            )}
            {activeTab === 'costs' && (
              <CostsTab logs={logs} lang={lang} theme={theme} onRefreshLogs={fetchAllData} />
            )}
            {activeTab === 'datacenter' && (
              <DataCenterTab lang={lang} theme={theme} />
            )}
            {activeTab === 'routing' && (
              <RoutingTab lang={lang} theme={theme} />
            )}
            {activeTab === 'specs' && (
              <SpecsTab lang={lang} theme={theme} />
            )}
            {activeTab === 'personas' && (
              <PersonasTab lang={lang} theme={theme} apps={apps} />
            )}
            {activeTab === 'auditlog' && (
              <AuditLogTab lang={lang} theme={theme} />
            )}
            {activeTab === 'health' && (
              <HealthTab lang={lang} theme={theme} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                lang={lang}
                setLang={setLang}
                theme={theme}
                setTheme={setTheme}
                adminEmail={adminEmail}
              />
            )}
          </div>
        </main>
      </div>
      <GlobalLoader loading={globalLoading} />
      {/* MyAI Master Chat Widget — persistent across all tabs */}
      <MyAIChatWidget
        apps={apps}
        logs={logs}
        apiKeys={apiKeys}
        documents={documents}
        businessProfile={businessProfile}
      />
    </div>
  );
}
