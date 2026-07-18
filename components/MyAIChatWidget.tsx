'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  X, 
  Send, 
  Sparkles, 
  Minimize2, 
  Maximize2,
  RefreshCw,
  ChevronDown,
  Bot,
  User,
  Copy,
  Check,
  Cpu,
  Zap,
  Brain,
  AlertCircle
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  provider?: string;
}

interface MyAIChatWidgetProps {
  // Pass live data from Dashboard for context
  apps?: any[];
  logs?: any[];
  apiKeys?: any[];
  documents?: any[];
  businessProfile?: any;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Halo! Saya **MyAI** — asisten AI eksklusif Bali Enterprises Group 👋

Saya adalah Super Manager AI yang siap membantu Anda dengan:
- 📊 **Analisis data** sistem dan penggunaan API
- 💼 **Strategi bisnis** & rekomendasi operasional  
- ✍️ **Pembuatan konten** berkualitas tinggi
- 📱 **Social media** & marketing insights
- 🏝️ **Visa & imigrasi Bali** — keahlian mendalam
- 🤖 **Manajemen sistem** MyAI OS Console

Saya sadar waktu, memiliki akses ke seluruh data sistem, dan terus berkembang.

Apa yang bisa saya bantu hari ini?`,
  timestamp: new Date().toISOString(),
  provider: "system"
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "text-emerald-400",
  openai2: "text-emerald-300",
  claude: "text-amber-400",
  gemini: "text-blue-400",
  error: "text-red-400",
  system: "text-purple-400",
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "GPT-4o",
  openai2: "GPT-4o",
  claude: "Claude",
  gemini: "Gemini",
  error: "Error",
  system: "MyAI",
};

function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<span class="flex items-start gap-1.5"><span class="mt-1 text-bento-accent shrink-0">•</span><span>$1</span></span>')
    .replace(/\n/g, '<br />');
}

export default function MyAIChatWidget({ apps = [], logs = [], apiKeys = [], documents = [], businessProfile = null }: MyAIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [currentProvider, setCurrentProvider] = useState("openai");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Bali time
  const getBaliTime = () => {
    const now = new Date();
    return now.toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
      setHasNewMessage(false);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant" && last.id !== "welcome") {
        setHasNewMessage(true);
      }
    }
  }, [messages, isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Build message history for API (exclude welcome message)
    const history = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: userMessage.content });

    try {
      const res = await fetch("/api/myai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.error ? `❌ ${data.error}` : (data.reply || "Tidak ada respons."),
        timestamp: new Date().toISOString(),
        provider: data.provider || "openai",
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (data.provider) setCurrentProvider(data.provider);

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ Terjadi kesalahan jaringan. Pastikan server berjalan.",
        timestamp: new Date().toISOString(),
        provider: "error",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  const widgetWidth = isMaximized ? "w-[700px]" : "w-[380px]";
  const widgetHeight = isMaximized ? "h-[85vh]" : "h-[600px]";

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setHasNewMessage(false); }}
          className="fixed bottom-6 right-6 z-50 group"
        >
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 shadow-2xl shadow-purple-900/50 flex items-center justify-center hover:scale-110 transition-all duration-300 border border-white/10">
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 animate-ping opacity-20" />
            <Brain className="h-7 w-7 text-white drop-shadow-lg" />
            {hasNewMessage && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-bento-bg animate-bounce" />
            )}
          </div>
          {/* Label tooltip */}
          <div className="absolute bottom-0 right-16 hidden group-hover:flex items-center gap-2 bg-bento-surface border border-bento-border rounded-xl px-3 py-1.5 shadow-xl whitespace-nowrap">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-bold text-bento-text-primary">MyAI Assistant</span>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 z-50 ${widgetWidth} ${widgetHeight} flex flex-col rounded-3xl border border-white/10 bg-[#0A0B0D] shadow-2xl shadow-black/60 overflow-hidden transition-all duration-300`}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-r from-violet-950/80 via-purple-950/80 to-indigo-950/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg">
                <Brain className="h-5 w-5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0A0B0D]" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white leading-none">MyAI</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                    Online · {PROVIDER_LABELS[currentProvider] || 'GPT-4o'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                title="Hapus percakapan"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                title={isMaximized ? "Perkecil" : "Perbesar"}
              >
                {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* System Info Bar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-white/3 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/40 uppercase tracking-wider">
              <Cpu className="h-3 w-3" />
              <span>{apps.length} apps</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/40 uppercase tracking-wider">
              <Zap className="h-3 w-3" />
              <span>{logs.length} logs</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="text-[9px] font-medium text-white/30 ml-auto">
              {getBaliTime()}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "user" 
                    ? "bg-indigo-600" 
                    : "bg-gradient-to-br from-violet-600 to-indigo-700"
                }`}>
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Brain className="h-3.5 w-3.5 text-white" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-white/5 border border-white/8 text-white/90 rounded-tl-sm"
                  }`}
                    dangerouslySetInnerHTML={{ 
                      __html: msg.role === "assistant" ? formatMessage(msg.content) : msg.content 
                    }}
                  />
                  {/* Meta */}
                  <div className={`flex items-center gap-2 mt-1 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <span className="text-[9px] text-white/20 font-medium">
                      {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.provider && msg.role === "assistant" && (
                      <span className={`text-[9px] font-bold ${PROVIDER_COLORS[msg.provider] || "text-white/30"}`}>
                        via {PROVIDER_LABELS[msg.provider] || msg.provider}
                      </span>
                    )}
                    {msg.role === "assistant" && msg.id !== "welcome" && (
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="text-white/20 hover:text-white/60 transition-colors"
                        title="Salin"
                      >
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2.5 animate-fade-in">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shrink-0">
                  <Brain className="h-3.5 w-3.5 text-white animate-pulse" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 border border-white/8 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[10px] text-white/40 font-medium">MyAI sedang berpikir...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-4 py-4 border-t border-white/5 bg-white/2 shrink-0">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tanya MyAI... (Enter untuk kirim, Shift+Enter untuk baris baru)"
                  rows={1}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-2xl bg-white/6 border border-white/10 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 resize-none leading-relaxed disabled:opacity-50 transition-all"
                  style={{ maxHeight: '120px', overflowY: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white hover:from-violet-500 hover:to-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[9px] text-white/20 mt-2 text-center font-medium">
              Provider: GPT-4o → Claude → Gemini · Semua data bersifat privat
            </p>
          </div>
        </div>
      )}
    </>
  );
}
