import { useState, useEffect } from "react";
import { ViewType, Language, ClientApp, ApiKey, UsageLog, BusinessProfile, KnowledgeDocument } from "./types";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import OverviewTab from "./components/OverviewTab";
import AppsTab from "./components/AppsTab";
import KnowledgeTab from "./components/KnowledgeTab";
import UsageTab from "./components/UsageTab";
import SettingsTab from "./components/SettingsTab";
import LoginScreen from "./components/LoginScreen";

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  // Appearance & Localization
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<Language>('id');

  // Active view in the dashboard
  const [activeTab, setActiveTab] = useState<ViewType>('overview');

  // Backend States
  const [apps, setApps] = useState<ClientApp[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);

  // Page loading states
  const [loading, setLoading] = useState(true);

  // Synchronize Auth & UI Choices with localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("myai_admin_email");
    if (savedEmail) {
      setIsAuthenticated(true);
      setAdminEmail(savedEmail);
    }

    const savedTheme = localStorage.getItem("myai_theme") as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    }

    const savedLang = localStorage.getItem("myai_lang") as Language;
    if (savedLang) {
      setLang(savedLang);
    }
  }, []);

  // Update theme class on HTML element
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

  // Update language in localStorage
  useEffect(() => {
    localStorage.setItem("myai_lang", lang);
  }, [lang]);

  // Fetch all backend data once authenticated
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [appsRes, keysRes, logsRes, profileRes, docsRes] = await Promise.all([
        fetch("/api/apps").then(r => r.json()),
        fetch("/api/keys").then(r => r.json()),
        fetch("/api/logs").then(r => r.json()),
        fetch("/api/business-profile").then(r => r.json()),
        fetch("/api/documents").then(r => r.json())
      ]);

      setApps(appsRes);
      setApiKeys(keysRes);
      setLogs(logsRes);
      setBusinessProfile(profileRes);
      setDocuments(docsRes);
    } catch (e) {
      console.error("Error loading backend data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated]);

  // Handle Log In
  const handleLoginSuccess = (email: string) => {
    setIsAuthenticated(true);
    setAdminEmail(email);
    localStorage.setItem("myai_admin_email", email);
  };

  // Handle Log Out
  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminEmail("");
    localStorage.removeItem("myai_admin_email");
  };

  // --- API Mutators ---

  const handleCreateApp = async (name: string, slug: string, tier: 'internal' | 'community') => {
    const response = await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, tier })
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to create app");
    }
    await fetchAllData();
  };

  const handleGenerateKey = async (clientAppId: string, scope: string[], rateLimit: number | null) => {
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_app_id: clientAppId, provider_scope: scope, rate_limit_per_day: rateLimit })
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to generate key");
    }
    const result = await response.json();
    await fetchAllData();
    return result; // contains full_key exactly once
  };

  const handleRevokeKey = async (keyId: string) => {
    const response = await fetch(`/api/keys/${keyId}/revoke`, {
      method: "POST"
    });
    if (!response.ok) {
      throw new Error("Failed to revoke key");
    }
    await fetchAllData();
  };

  const handleSaveProfile = async (content: string) => {
    const response = await fetch("/api/business-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    if (!response.ok) {
      throw new Error("Failed to save profile");
    }
    const updated = await response.json();
    setBusinessProfile(updated);
  };

  const handleAddDocument = async (title: string, content: string, clientAppId: string | null) => {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, client_app_id: clientAppId })
    });
    if (!response.ok) {
      throw new Error("Failed to add document");
    }
    await fetchAllData();
  };

  const handleEditDocument = async (id: string, title: string, content: string, clientAppId: string | null) => {
    const response = await fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, client_app_id: clientAppId })
    });
    if (!response.ok) {
      throw new Error("Failed to update document");
    }
    await fetchAllData();
  };

  const handleDeleteDocument = async (id: string) => {
    const response = await fetch(`/api/documents/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error("Failed to delete document");
    }
    await fetchAllData();
  };

  // Unauthenticated screen
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        lang={lang}
        setLang={setLang}
        theme={theme}
      />
    );
  }

  // Loading screen
  if (loading || !businessProfile) {
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#060709] text-white' : 'bg-[#FAFAFA] text-[#1F2937]'
      }`}>
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#5B8DEF]/10 text-[#5B8DEF] flex items-center justify-center mx-auto animate-spin">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-xs font-semibold tracking-wider uppercase opacity-60">Initializing MyAI OS Console...</p>
        </div>
      </div>
    );
  }

  // Main Authenticated Dashboard Layout
  return (
    <div className="flex h-screen overflow-hidden bg-bento-bg text-bento-text-primary" id="console-layout">
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        theme={theme}
        onLogout={handleLogout}
        adminEmail={adminEmail}
      />

      {/* Main content body container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top interactive navbar */}
        <Navbar
          activeTab={activeTab}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
        />

        {/* Scrollable dynamic tab view */}
        <main className="flex-1 overflow-y-auto p-8 focus:outline-none">
          <div className="max-w-6xl mx-auto pb-12">
            {activeTab === 'overview' && (
              <OverviewTab
                apps={apps}
                apiKeys={apiKeys}
                logs={logs}
                lang={lang}
                theme={theme}
              />
            )}

            {activeTab === 'apps' && (
              <AppsTab
                apps={apps}
                apiKeys={apiKeys}
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
              <UsageTab
                apps={apps}
                logs={logs}
                lang={lang}
                theme={theme}
              />
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
    </div>
  );
}
