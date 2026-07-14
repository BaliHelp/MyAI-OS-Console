import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to file-based persistent DB
const DB_PATH = path.join(process.cwd(), "db.json");

// Helper to generate IDs
const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Seed Data
const getInitialDb = () => {
  const appVisasId = "app-visas-" + uuid().substring(0, 4);
  const appTropicId = "app-tropic-" + uuid().substring(0, 4);
  const appWebId = "app-web-" + uuid().substring(0, 4);
  const appPlayId = "app-play-" + uuid().substring(0, 4);
  const appStoreId = "app-store-" + uuid().substring(0, 4);

  const clientApps = [
    { id: appVisasId, name: "Indonesian Visas", slug: "indonesian-visas", tier: "internal", status: "active", created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    { id: appTropicId, name: "Tropic Tech", slug: "tropic-tech", tier: "internal", status: "active", created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
    { id: appWebId, name: "MyBusiness Website", slug: "mybusiness-website", tier: "internal", status: "active", created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
    { id: appPlayId, name: "MyBusiness Playstore", slug: "mybusiness-playstore", tier: "internal", status: "active", created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
    { id: appStoreId, name: "MyBusiness Appstore", slug: "mybusiness-appstore", tier: "community", status: "active", created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  const apiKeys = [
    { id: "key-1", client_app_id: appVisasId, key_prefix: "sk_visas_a8f3", key_hash: "hashed_key_1", provider_scope: ["claude", "gpt", "gemini"], rate_limit_per_day: null, status: "active", created_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(), last_used_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    { id: "key-2", client_app_id: appTropicId, key_prefix: "sk_tropic_7d2f", key_hash: "hashed_key_2", provider_scope: ["claude", "gemini"], rate_limit_per_day: null, status: "active", created_at: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString(), last_used_at: new Date(Date.now() - 22 * 60 * 1000).toISOString() },
    { id: "key-3", client_app_id: appWebId, key_prefix: "sk_myweb_bc11", key_hash: "hashed_key_3", provider_scope: ["gpt", "gemini"], rate_limit_per_day: null, status: "active", created_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(), last_used_at: new Date(Date.now() - 42 * 60 * 1000).toISOString() },
    { id: "key-4", client_app_id: appPlayId, key_prefix: "sk_myplay_910e", key_hash: "hashed_key_4", provider_scope: ["gemini"], rate_limit_per_day: null, status: "active", created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), last_used_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
    { id: "key-5", client_app_id: appStoreId, key_prefix: "sk_mystore_3e4d", key_hash: "hashed_key_5", provider_scope: ["claude", "gpt"], rate_limit_per_day: 1000, status: "active", created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), last_used_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  ];

  // Generate 14 days of realistic usage logs
  const usageLogs: any[] = [];
  const providers = ["claude", "gpt", "gemini"];
  const taskTypes = ["text", "image", "audio", "embeddings"];
  const keys = [
    { id: "key-1", appName: "Indonesian Visas" },
    { id: "key-2", appName: "Tropic Tech" },
    { id: "key-3", appName: "MyBusiness Website" },
    { id: "key-4", appName: "MyBusiness Playstore" },
    { id: "key-5", appName: "MyBusiness Appstore" }
  ];

  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Create multiple logs for each day
    keys.forEach((k) => {
      // Internal apps call more frequently, community less
      const isCommunity = k.id === "key-5";
      const callCount = isCommunity ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 6) + 3;

      for (let c = 0; c < callCount; c++) {
        const provider = providers[Math.floor(Math.random() * providers.length)];
        const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
        let tokens = Math.floor(Math.random() * 2500) + 200;
        if (taskType === "image") tokens = 1000; // flat token cost for image
        if (taskType === "audio") tokens = 500;

        // Specific hours
        const logDate = new Date(date);
        logDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

        usageLogs.push({
          id: "log-" + uuid().substring(0, 6),
          api_key_id: k.id,
          app_name: k.appName,
          provider,
          task_type: taskType,
          tokens_used: tokens,
          created_at: logDate.toISOString()
        });
      }
    });
  }

  // Sort logs by newest first
  usageLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const businessProfile = {
    id: "profile-1",
    title: "MyBusiness Ecosystem Core",
    content: "MyBusiness is a multi-product ecosystem serving domestic and international clients. Our products include:\n1. **Indonesian Visas**: Premium digital visa services helping tourists and digital nomads process paperwork with maximum trust.\n2. **Tropic Tech**: Bespoke IT consultation and custom software development specializing in sustainable cloud solutions for companies in Southeast Asia.\n3. **MyBusiness Core Suite**: The central platform representing our main website, Playstore app, and Appstore app that links services, processes payments, and manages user identity.\n\nAll products consume centralized AI services through our internal MyAI OS Gateway to ensure consistent context, rate limit auditing, and cost optimization.",
    updated_at: new Date().toISOString()
  };

  const knowledgeDocuments = [
    {
      id: "doc-1",
      client_app_id: appVisasId,
      title: "Indonesian Visas - FAQ Kebijakan Pengembalian (Refund)",
      content: "Pengguna berhak mengajukan pengembalian dana 100% apabila dokumen permohonan visa ditolak secara resmi oleh Imigrasi Indonesia karena kesalahan teknis dari tim kami. Pengembalian tidak berlaku apabila dokumen penunjang yang dikirim oleh pengguna palsu, tidak lengkap, atau jika pengguna membatalkan sepihak setelah aplikasi diunggah ke portal resmi imigrasi.",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "doc-2",
      client_app_id: appTropicId,
      title: "Tropic Tech - Panduan Integrasi API Klien",
      content: "Semua API Tropic Tech harus dipanggil menggunakan HTTPS. Endpoint produksi di-host di `api.tropictech.com/v1/`. Rate limit default adalah 120 request per menit per IP address. Untuk otentikasi, gunakan header `Authorization: Bearer <client_token>`. Format respon selalu JSON.",
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "doc-3",
      client_app_id: null, // global
      title: "MyBusiness Ecosystem - Aturan Tone of Voice AI",
      content: "Semua asisten AI di seluruh produk MyBusiness harus mematuhi panduan kepribadian ini:\n- **Nada Bicara**: Profesional, bersahabat, ringkas, dan jujur. Jangan pernah memberikan janji palsu atau spekulatif.\n- **Bahasa**: Secara default gunakan Bahasa Indonesia yang sopan namun modern. Dukung Bahasa Inggris untuk audiens internasional.\n- **Gaya Penulisan**: Gunakan poin-poin terstruktur untuk hal penting, hindari dinding teks yang panjang.",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  return {
    clientApps,
    apiKeys,
    usageLogs,
    businessProfile,
    knowledgeDocuments
  };
};

// Database state
let db: ReturnType<typeof getInitialDb>;

const loadDb = () => {
  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (e) {
      console.error("Error reading database file, using seed data", e);
      db = getInitialDb();
      saveDb();
    }
  } else {
    db = getInitialDb();
    saveDb();
  }
};

const saveDb = () => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving database file", e);
  }
};

// Initialize DB
loadDb();

// --- API Endpoints ---

// Auth endpoints
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  // Simple single admin credentials for private console
  if (email === "rimbanusaonline@gmail.com" || email === "admin@mybusiness.com") {
    // any password for preview, but let's encourage admin
    return res.json({
      success: true,
      user: {
        email,
        role: "owner",
        name: "Admin MyBusiness"
      }
    });
  }
  return res.status(401).json({ error: "Invalid credentials. Use rimbanusaonline@gmail.com to sign in." });
});

// App Management
app.get("/api/apps", (req, res) => {
  const appsWithKeyCounts = db.clientApps.map(app => {
    const key_count = db.apiKeys.filter(k => k.client_app_id === app.id && k.status === "active").length;
    return { ...app, key_count };
  });
  res.json(appsWithKeyCounts);
});

app.post("/api/apps", (req, res) => {
  const { name, slug, tier } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: "Name and slug are required" });
  }

  // Check unique slug
  if (db.clientApps.some(a => a.slug === slug)) {
    return res.status(400).json({ error: "Slug must be unique" });
  }

  const newApp = {
    id: "app-" + uuid().substring(0, 6),
    name,
    slug,
    tier: tier || "internal",
    status: "active",
    created_at: new Date().toISOString()
  };

  db.clientApps.push(newApp);
  saveDb();
  res.status(211).json(newApp);
});

// Keys Management
app.get("/api/keys", (req, res) => {
  res.json(db.apiKeys);
});

app.get("/api/apps/:appId/keys", (req, res) => {
  const keys = db.apiKeys.filter(k => k.client_app_id === req.params.appId);
  res.json(keys);
});

app.post("/api/keys", (req, res) => {
  const { client_app_id, provider_scope, rate_limit_per_day } = req.body;
  if (!client_app_id) {
    return res.status(400).json({ error: "client_app_id is required" });
  }

  // Generate full key (mock format e.g. mb_live_abc123...)
  const suffix = uuid().substring(0, 16);
  const prefixSuffix = uuid().substring(0, 4);
  
  // Find app name for prefix
  const app = db.clientApps.find(a => a.id === client_app_id);
  const appPrefix = app ? app.slug.substring(0, 8).replace("-", "") : "key";
  
  const keyPrefix = `sk_${appPrefix}_${prefixSuffix}`;
  const fullKey = `${keyPrefix}_${suffix}`;

  const newKey = {
    id: "key-" + uuid().substring(0, 6),
    client_app_id,
    key_prefix: keyPrefix,
    key_hash: "hashed_" + suffix, // in real life we hash fullKey
    provider_scope: provider_scope || ["claude", "gpt", "gemini"],
    rate_limit_per_day: rate_limit_per_day ? parseInt(rate_limit_per_day) : null,
    status: "active",
    created_at: new Date().toISOString(),
    last_used_at: null
  };

  db.apiKeys.push(newKey);
  saveDb();

  // Return the full key ONLY this once, alongside metadata
  res.status(211).json({
    ...newKey,
    full_key: fullKey
  });
});

app.post("/api/keys/:id/revoke", (req, res) => {
  const key = db.apiKeys.find(k => k.id === req.params.id);
  if (!key) {
    return res.status(404).json({ error: "Key not found" });
  }

  key.status = "revoked";
  saveDb();
  res.json(key);
});

// Usage Logs
app.get("/api/logs", (req, res) => {
  res.json(db.usageLogs);
});

// Business Profile
app.get("/api/business-profile", (req, res) => {
  res.json(db.businessProfile);
});

app.post("/api/business-profile", (req, res) => {
  const { content } = req.body;
  db.businessProfile.content = content || "";
  db.businessProfile.updated_at = new Date().toISOString();
  saveDb();
  res.json(db.businessProfile);
});

// Knowledge Documents
app.get("/api/documents", (req, res) => {
  res.json(db.knowledgeDocuments);
});

app.post("/api/documents", (req, res) => {
  const { client_app_id, title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required" });
  }

  const newDoc = {
    id: "doc-" + uuid().substring(0, 6),
    client_app_id: client_app_id || null,
    title,
    content,
    created_at: new Date().toISOString()
  };

  db.knowledgeDocuments.push(newDoc);
  saveDb();
  res.status(211).json(newDoc);
});

app.put("/api/documents/:id", (req, res) => {
  const doc = db.knowledgeDocuments.find(d => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  const { client_app_id, title, content } = req.body;
  if (title) doc.title = title;
  if (content) doc.content = content;
  doc.client_app_id = client_app_id !== undefined ? client_app_id : doc.client_app_id;

  saveDb();
  res.json(doc);
});

app.delete("/api/documents/:id", (req, res) => {
  const index = db.knowledgeDocuments.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Document not found" });
  }

  db.knowledgeDocuments.splice(index, 1);
  saveDb();
  res.json({ success: true });
});

// Gemini Endpoint
app.post("/api/gemini/query-knowledge", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    // Gather all knowledge context
    const docsContext = db.knowledgeDocuments.map(d => {
      const app = db.clientApps.find(a => a.id === d.client_app_id);
      const appScope = app ? `Scope: Product ${app.name}` : "Scope: Global/Shared";
      return `Document: "${d.title}" (${appScope})\nContent: ${d.content}`;
    }).join("\n\n");

    const fullContext = `You are "MyAI OS Gateway Helper" - a secure assistant for the admin console.
Here is the core corporate and product knowledge base:

Business Profile:
${db.businessProfile.content}

Knowledge Base Documents:
${docsContext}

The user (the ecosystem admin/founder) has asked you a question or requested a summary based on this knowledge. Answer clearly, accurately, and professionally. Maintain absolute respect for confidential operations. If the answer cannot be found in the knowledge base, state that clearly but offer a helpful inference based on general context. Default to Indonesian language as the console default, but support English if asked.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Return a simulated, super-smart response if key is placeholder so it's fully functional for testing
      console.warn("GEMINI_API_KEY is not configured or is placeholder. Using smart simulated response.");
      
      // Basic rule matching for realistic offline test
      let simulatedResponse = "Halo! Gateway Helper di sini. GEMINI_API_KEY belum terkonfigurasi di file `.env`, namun berikut adalah informasi yang berhasil dianalisis secara lokal:\n\n";
      
      if (prompt.toLowerCase().includes("visa") || prompt.toLowerCase().includes("refund")) {
        simulatedResponse += "Berdasarkan dokumen **'Indonesian Visas - FAQ Kebijakan Pengembalian (Refund)'**, pengembalian dana 100% hanya disetujui jika ada kesalahan teknis dari tim internal yang mengakibatkan penolakan resmi dari imigrasi. Pengembalian ditolak apabila user memberikan berkas palsu atau membatalkan sepihak.";
      } else if (prompt.toLowerCase().includes("tropic") || prompt.toLowerCase().includes("api")) {
        simulatedResponse += "Berdasarkan dokumen **'Tropic Tech - Panduan Integrasi API Klien'**, integrasi harus menggunakan HTTPS dengan endpoint `api.tropictech.com/v1/`. Rate limit default yang ditentukan adalah 120 request per menit per alamat IP.";
      } else if (prompt.toLowerCase().includes("tone") || prompt.toLowerCase().includes("bicara")) {
        simulatedResponse += "Berdasarkan pedoman **'MyBusiness Ecosystem - Aturan Tone of Voice AI'**, semua AI di ekosistem asisten wajib bersikap profesional, bersahabat, ringkas, dan jujur. Bahasa default yang disarankan adalah Bahasa Indonesia yang sopan namun modern.";
      } else {
        simulatedResponse += `Terkait pertanyaan Anda: "${prompt}"\n\nEkosistem MyBusiness saat ini mengelola 5 aplikasi (Indonesian Visas, Tropic Tech, MyBusiness Website, Playstore, dan Appstore) yang semuanya terhubung ke satu pintu internal AI Gateway. Semua data asisten tersimpan aman di pusat pengetahuan yang dapat dikonfigurasi melalui tab ini.`;
      }
      return res.json({ text: simulatedResponse });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: fullContext,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: `AI Error: ${err.message || err}` });
  }
});

// --- Dev server / build production serving ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MyAI OS Console server running on http://localhost:${PORT}`);
  });
}

startServer();
