"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface GroqModel {
  id: string;
  label: string;
  description: string;
  badge?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GROQ_MODELS: GroqModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    description: "Versatile & powerful",
    badge: "Recommended",
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B",
    description: "Fast & lightweight",
    badge: "Fast",
  },
  {
    id: "mixtral-8x7b-32768",
    label: "Mixtral 8x7B",
    description: "32k context window",
  },
  {
    id: "gemma2-9b-it",
    label: "Gemma 2 9B",
    description: "Google's efficient model",
  },
];

const STARTER_PROMPTS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/>
      </svg>
    ),
    text: "Explain quantum computing in simple terms",
    label: "Explain a concept",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
    text: "Write a Python script to scrape website data",
    label: "Write code",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    text: "Help me write a professional email to my manager",
    label: "Draft an email",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    text: "What are the key principles of machine learning?",
    label: "Research a topic",
  },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text: string): string {
  // Fenced code blocks
  text = text.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, lang, code) =>
      `<pre class="${styles.codeBlock}"><div class="${styles.codeLang}"><span>${lang || "plaintext"}</span></div><code>${escapeHtml(code.trim())}</code></pre>`
  );
  // Inline code
  text = text.replace(/`([^`]+)`/g, `<code class="${styles.inlineCode}">$1</code>`);
  // Bold + italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Headers
  text = text.replace(/^### (.+)$/gm, `<h3 class="${styles.mdH3}">$1</h3>`);
  text = text.replace(/^## (.+)$/gm, `<h2 class="${styles.mdH2}">$1</h2>`);
  text = text.replace(/^# (.+)$/gm, `<h1 class="${styles.mdH1}">$1</h1>`);
  // HR
  text = text.replace(/^---$/gm, `<hr class="${styles.mdHr}" />`);
  // Ordered lists
  text = text.replace(/^\d+\. (.+)$/gm, `<li class="${styles.mdLi}">$1</li>`);
  text = text.replace(/(<li[\s\S]*?<\/li>\n?)+/g, (m) =>
    m.includes("<ol") ? m : `<ol class="${styles.mdOl}">${m}</ol>`
  );
  // Unordered lists
  text = text.replace(/^[•\-\*] (.+)$/gm, `<li class="${styles.mdLi}">$1</li>`);
  text = text.replace(/(<li[\s\S]*?<\/li>\n?)+/g, (m) =>
    m.includes("<ol") ? m : `<ul class="${styles.mdUl}">${m}</ul>`
  );
  // Paragraphs
  text = text.replace(/\n\n/g, `</p><p class="${styles.mdP}">`);
  text = `<p class="${styles.mdP}">${text}</p>`;
  text = text.replace(/\n/g, "<br />");
  return text;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className={styles.typingDots} aria-label="AI is thinking">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={styles.actionBtn}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      title={copied ? "Copied!" : "Copy response"}
      aria-label="Copy response"
    >
      {copied ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const html = isUser ? undefined : renderMarkdown(message.content);

  return (
    <div className={`${styles.messageRow} ${isUser ? styles.userMessageRow : styles.aiMessageRow}`}>
      <div className={styles.messageInner}>
        {/* Avatar */}
        <div className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.aiAvatar}`}>
          {isUser ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 41 41" fill="none">
              <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.505-3.357 10.078 10.078 0 0 0-9.612 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.357 10.079 10.079 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.814zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.5v4.999l-4.331 2.5-4.331-2.5V18z" fill="currentColor"/>
            </svg>
          )}
        </div>

        {/* Content */}
        <div className={styles.messageContent}>
          <div className={styles.roleLabel}>{isUser ? "You" : "Groq"}</div>
          {isUser ? (
            <div className={styles.userText}>{message.content}</div>
          ) : (
            <>
              {message.isStreaming && message.content === "" ? (
                <TypingDots />
              ) : (
                <div
                  className={styles.aiText}
                  dangerouslySetInnerHTML={{ __html: html || "" }}
                />
              )}
              {!message.isStreaming && message.content && (
                <div className={styles.messageActions}>
                  <CopyButton text={message.content} />
                  <span className={styles.timestamp}>
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(GROQ_MODELS[0].id);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelDropRef.current && !modelDropRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("groq_api_key");
    if (saved) setApiKey(saved);
  }, []);

  const handleSaveApiKey = useCallback((key: string) => {
    setApiKey(key);
    localStorage.setItem("groq_api_key", key);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 220) + "px";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;
    if (!apiKey.trim()) {
      setError("Add your Groq API key first — click the API Key button below.");
      return;
    }

    setError(null);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const userMsg: Message = { id: uid(), role: "user", content: text, timestamp: new Date() };
    const aiMsgId = uid();
    const aiMsg: Message = { id: aiMsgId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true };

    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, aiMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          model: selectedModel,
          messages: newMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let aiContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (delta) {
              aiContent += delta;
              setMessages(prev =>
                prev.map(m => m.id === aiMsgId ? { ...m, content: aiContent, isStreaming: true } : m)
              );
            }
          } catch { /* ignore */ }
        }
      }

      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false } : m));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages(prev => prev.filter(m => m.id !== aiMsgId));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const selectedModelInfo = GROQ_MODELS.find(m => m.id === selectedModel)!;

  return (
    <div className={styles.app}>

      {/* ─── Sidebar ─── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        <div className={styles.sidebarTop}>
          <button
            id="toggle-sidebar-btn"
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {sidebarOpen && (
            <button
              id="new-chat-btn"
              className={styles.newChatBtn}
              onClick={() => { setMessages([]); setError(null); }}
              title="New chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
        </div>

        {sidebarOpen && (
          <>
            <div className={styles.sidebarBrand}>
              <div className={styles.brandIcon}>
                <svg width="18" height="18" viewBox="0 0 41 41" fill="none">
                  <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.505-3.357 10.078 10.078 0 0 0-9.612 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.357 10.079 10.079 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.814z" fill="currentColor"/>
                </svg>
              </div>
              <span className={styles.brandName}>Groq Chat</span>
            </div>

            <nav className={styles.sidebarNav}>
              {messages.length > 0 && (
                <div className={styles.navSection}>
                  <span className={styles.navSectionLabel}>Today</span>
                  <button
                    className={styles.navItem}
                    onClick={() => {}}
                    title="Current conversation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span className={styles.navItemText}>
                      {messages[0]?.content.slice(0, 28)}…
                    </span>
                  </button>
                </div>
              )}
            </nav>

            <div className={styles.sidebarBottom}>
              <button
                id="sidebar-api-key-btn"
                className={styles.sidebarAction}
                onClick={() => setShowSettingsModal(true)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>API Key</span>
                {apiKey ? (
                  <span className={styles.keyStatusDot} title="API key configured" />
                ) : (
                  <span className={styles.keyMissingDot} title="API key required" />
                )}
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ─── Main ─── */}
      <div className={styles.main}>

        {/* Top bar */}
        <div className={styles.topBar}>
          {!sidebarOpen && (
            <button
              className={styles.sidebarToggleTop}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}

          {/* Model picker */}
          <div className={styles.modelPicker} ref={modelDropRef}>
            <button
              id="model-selector-btn"
              className={styles.modelPickerBtn}
              onClick={() => setShowModelDropdown(v => !v)}
              aria-expanded={showModelDropdown}
            >
              <span>{selectedModelInfo.label}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: showModelDropdown ? "rotate(180deg)" : undefined, transition: "transform 180ms" }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showModelDropdown && (
              <div className={styles.modelMenu} role="listbox">
                {GROQ_MODELS.map(m => (
                  <button
                    key={m.id}
                    id={`model-${m.id}`}
                    role="option"
                    aria-selected={m.id === selectedModel}
                    className={`${styles.modelMenuItem} ${m.id === selectedModel ? styles.modelMenuItemActive : ""}`}
                    onClick={() => { setSelectedModel(m.id); setShowModelDropdown(false); }}
                  >
                    <div className={styles.modelMenuItemTop}>
                      <span className={styles.modelMenuLabel}>{m.label}</span>
                      {m.badge && <span className={styles.menuBadge}>{m.badge}</span>}
                    </div>
                    <span className={styles.modelMenuDesc}>{m.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.topBarRight}>
            {messages.length > 0 && (
              <button
                id="clear-chat-btn"
                className={styles.topBarBtn}
                onClick={() => { setMessages([]); setError(null); }}
                title="New chat"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className={styles.conversation} id="chat-main">
          {messages.length === 0 ? (
            <div className={styles.emptyState} id="empty-state">
              <h1 className={styles.emptyTitle}>What can I help with?</h1>

              {!apiKey && (
                <div className={styles.apiNotice}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>
                    No API key configured.{" "}
                    <button className={styles.apiNoticeBtn} onClick={() => setShowSettingsModal(true)}>
                      Add your Groq API key
                    </button>
                    {" "}to start chatting.
                  </span>
                </div>
              )}

              <div className={styles.starterGrid}>
                {STARTER_PROMPTS.map((s, i) => (
                  <button
                    key={i}
                    id={`starter-${i}`}
                    className={styles.starterBtn}
                    onClick={() => handleSend(s.text)}
                    disabled={!apiKey}
                  >
                    <span className={styles.starterBtnIcon}>{s.icon}</span>
                    <div className={styles.starterBtnBody}>
                      <span className={styles.starterBtnLabel}>{s.label}</span>
                      <span className={styles.starterBtnText}>{s.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.messages} id="messages-container">
              {messages.map(msg => (
                <MessageRow key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} className={styles.scrollAnchor} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBar} role="alert" id="error-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
            <button
              id="dismiss-error-btn"
              className={styles.errorClose}
              onClick={() => setError(null)}
              aria-label="Dismiss"
            >✕</button>
          </div>
        )}

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrap}>
            <textarea
              ref={inputRef}
              id="chat-input"
              className={styles.inputBox}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message Groq Chat"
              rows={1}
              disabled={isLoading}
              aria-label="Chat message"
            />
            <div className={styles.inputFooter}>
              <button
                id="api-key-quick-btn"
                className={styles.inputFooterBtn}
                onClick={() => setShowSettingsModal(true)}
                title="Configure API key"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {apiKey ? "API Key ✓" : "Add API Key"}
              </button>
              <button
                id="send-btn"
                className={`${styles.sendBtn} ${!input.trim() || isLoading ? styles.sendBtnOff : styles.sendBtnOn}`}
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                {isLoading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.spinIcon}>
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className={styles.disclaimer}>
            Groq Chat can make mistakes. Verify important information.
          </p>
        </div>
      </div>

      {/* ─── API Key Modal ─── */}
      {showSettingsModal && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="API Key Settings">
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Configure API Key</h2>
              <button
                id="close-modal-btn"
                className={styles.modalClose}
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <p className={styles.modalDesc}>
              Get your free API key from{" "}
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className={styles.modalLink}>
                console.groq.com
              </a>
              . Keys are stored only in your browser.
            </p>

            <div className={styles.modalField}>
              <label htmlFor="api-key-input" className={styles.modalLabel}>Groq API Key</label>
              <div className={styles.modalInputRow}>
                <input
                  id="api-key-input"
                  type={showApiKey ? "text" : "password"}
                  className={styles.modalInput}
                  value={apiKey}
                  onChange={e => handleSaveApiKey(e.target.value)}
                  placeholder="gsk_••••••••••••••••••••"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  id="toggle-key-visibility"
                  className={styles.eyeBtn}
                  onClick={() => setShowApiKey(v => !v)}
                  aria-label={showApiKey ? "Hide key" : "Show key"}
                >
                  {showApiKey ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {apiKey && (
                <span className={styles.keyOk}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  API key saved in browser storage
                </span>
              )}
            </div>

            <button
              id="save-close-modal-btn"
              className={styles.modalSaveBtn}
              onClick={() => setShowSettingsModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
