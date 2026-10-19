const plugin = {"$schema": "https://acode.app/schema/plugin/v0.1.0.json", "id": "com.witai.coder", "name": "WIT AI", "main": "main.js", "version": "1.4.15", "readme": "readme.md", "changelogs": "changelog.md", "icon": "icon.png", "files": ["main.js", "readme.md", "changelog.md", "LICENSE", "NOTICE", "icon.png"], "minVersionCode": 290, "license": "Apache-2.0", "keywords": ["ai", "groq", "openai", "anthropic", "gemini", "huggingface", "coder", "assistant"], "price": 0, "permissions": [], "author": {"name": "Mikael Kraft (Ivytag World)", "email": "mikewillkraft@gmail.com", "github": "mikaelkraft", "url": "https://github.com/mikaelkraft"}};
/**
 * WIT AI v1.4.15 — multi-provider AI coding assistant for Acode
 * Sessions · agent-from-chat · apply-to-file · stronger project context
 */
class WitAI {
  baseUrl = "";
  ctx = null;
  $page = null;
  history = [];
  isStreaming = false;
  abortController = null;
  lastUsage = null;
  panelOpen = false;
  sessions = [];
  currentSessionId = null;
  panelHost = null;
  attachedFiles = []; // { name, path, content }
  webForceOn = false; // session toggle: always use web lookup
  actionBusy = false; // prevent multi-tap Fix/Generate

  // Offline fallback only — live /models from the user's key is preferred
  MODELS = {
    groq: [
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    ],
    openai: [
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-5-mini", label: "GPT-5 mini" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
    ],
    anthropic: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-opus-5", label: "Claude Opus 5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
    gemini: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
    huggingface: [
      { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct" },
    ],
    openai_compatible: [
      { id: "custom", label: "Custom model ID…" },
    ],
  };

  ENDPOINT_PRESETS = [
    { id: "openai", label: "OpenAI", url: "https://api.openai.com/v1" },
    { id: "openrouter", label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
    { id: "groq_compat", label: "Groq (OpenAI path)", url: "https://api.groq.com/openai/v1" },
    { id: "gemini_compat", label: "Gemini OpenAI-compat", url: "https://generativelanguage.googleapis.com/v1beta/openai" },
    { id: "deepseek", label: "DeepSeek", url: "https://api.deepseek.com/v1" },
    { id: "together", label: "Together AI", url: "https://api.together.xyz/v1" },
    { id: "fireworks", label: "Fireworks", url: "https://api.fireworks.ai/inference/v1" },
    { id: "ollama", label: "Ollama (local)", url: "http://127.0.0.1:11434/v1" },
    { id: "brewkeg", label: "BrewKeg", url: "https://brewkeg.dev/v1" },
    { id: "custom", label: "Custom URL…", url: "" },
  ];

  async init($page, _cacheFile, _cacheFileUrl, _firstInit, ctx) {
    this.ctx = ctx;
    this.$page = $page;

    const commands = acode.require("commands");
    const cmds = [
      { name: "witai.open", desc: "WIT AI – Open assistant", key: { win: "Ctrl-Shift-W", mac: "Command-Shift-W" }, fn: () => this.openChatUI() },
      { name: "witai.fix", desc: "WIT AI – Fix current file / selection", key: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" }, fn: () => this.quickAction("fix") },
      { name: "witai.generate", desc: "WIT AI – Generate code / feature", key: { win: "Ctrl-Shift-G", mac: "Command-Shift-G" }, fn: () => this.quickAction("generate") },
      { name: "witai.agent", desc: "WIT AI – Multi-step agent", key: { win: "Ctrl-Shift-A", mac: "Command-Shift-A" }, fn: () => this.runAgent() },
      { name: "witai.chat", desc: "WIT AI – Chat panel", fn: () => this.openChatUI() },
      { name: "witai.newproject", desc: "WIT AI – Scaffold new project", fn: () => this.newProject() },
      { name: "witai.settings", desc: "WIT AI – Settings / API keys", fn: () => this.openSettings() },
    ];
    for (const c of cmds) {
      commands.addCommand({ name: c.name, description: c.desc, bindKey: c.key, exec: c.fn });
    }

    // Visible entry: sidebar app icon
    try {
      const sideBarApps = acode.require("sidebarApps");
      // Use a built-in-looking icon class; many themes map "chat_bubble" / "robot"
      sideBarApps.add(
        "witai_star",
        "witai_sidebar",
        "WIT AI",
        (container) => {
          this.sidebarContainer = container;
          this.renderSidebarChat(container);
        },
        false,
        (container) => {
          if (container) this.renderSidebarChat(container);
        }
      );
      // Style sidebar entry to match FAB (star) if the icon class is unknown
      try {
        const styleId = "witai-sidebar-icon-style";
        if (!document.getElementById(styleId)) {
          const st = document.createElement("style");
          st.id = styleId;
          st.textContent = `
            .icon.witai_star, .witai_star {
              display:flex!important;align-items:center;justify-content:center;
            }
            /* Default: strong violet — readable on light/white sidebars */
            .icon.witai_star::before, .witai_star::before {
              content:"✦";
              font-size:20px;
              font-weight:700;
              color:#5b21b6 !important;
              text-shadow: 0 1px 0 rgba(255,255,255,.8), 0 0 2px rgba(91,33,182,.35);
            }
            /* Dark / dim chrome: light star with glow */
            body.dark .icon.witai_star::before,
            body.dark .witai_star::before,
            .dark .icon.witai_star::before,
            .dark .witai_star::before,
            [data-theme="dark"] .icon.witai_star::before,
            [data-theme="dark"] .witai_star::before,
            .sidebar.dark .icon.witai_star::before,
            .app-container.dark .icon.witai_star::before {
              color:#f8fafc !important;
              text-shadow: 0 0 8px rgba(167,139,250,.95), 0 1px 2px rgba(0,0,0,.75);
            }
            @media (prefers-color-scheme: dark) {
              .icon.witai_star::before, .witai_star::before {
                color:#f8fafc !important;
                text-shadow: 0 0 8px rgba(167,139,250,.95), 0 1px 2px rgba(0,0,0,.75);
              }
            }
          `;
          document.head.appendChild(st);
        }
      } catch { /* ignore */ }
    } catch (e) {
      console.warn("WIT AI: sidebarApps not available", e);
    }

    // Floating chat bubble on the editor
    this.installFab();
    await this.loadHistory();
    await this.loadSessions();
    if (!this.ctx) {
      console.warn("WIT AI: ctx unavailable — using localStorage for keys");
    }
  }

  async destroy() {
    if (this.abortController) this.abortController.abort();
    const commands = acode.require("commands");
    ["witai.open", "witai.fix", "witai.generate", "witai.agent", "witai.chat", "witai.newproject", "witai.settings"]
      .forEach((n) => commands.removeCommand(n));
    try {
      const sideBarApps = acode.require("sidebarApps");
      sideBarApps.remove("witai_sidebar");
    } catch { /* ignore */ }
    this.removeFab();
  }

  installFab() {
    this.removeFab();
    const btn = document.createElement("button");
    btn.id = "witai-fab";
    btn.type = "button";
    btn.title = "WIT AI";
    btn.setAttribute("aria-label", "Open WIT AI");
    btn.innerHTML = "✦";
    Object.assign(btn.style, {
      position: "fixed",
      right: "12px",
      bottom: "96px",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "2px solid #fff",
      background: "linear-gradient(135deg,#6c5ce7,#a29bfe)",
      color: "#fff",
      fontSize: "24px",
      boxShadow: "0 6px 18px rgba(0,0,0,.45)",
      zIndex: "10050",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "auto",
      touchAction: "manipulation",
      webkitUserSelect: "none",
      userSelect: "none",
      opacity: "1",
      visibility: "visible",
    });
    const fire = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      } catch { /* */ }
      try { this.openChatUI(); } catch (err) {
        console.error("WIT AI openChatUI", err);
        try { this.openPanel(); } catch { /* */ }
      }
    };
    ["pointerup", "click", "touchend"].forEach((ev) => {
      btn.addEventListener(ev, fire, true);
    });
    document.body.appendChild(btn);
    this.fabEl = btn;
    // Re-assert on top after UI settles (Acode may reparent)
    clearTimeout(this._fabTimer);
    this._fabTimer = setTimeout(() => {
      try {
        if (this.fabEl && this.fabEl.parentNode !== document.body) {
          document.body.appendChild(this.fabEl);
        }
      } catch { /* */ }
    }, 1500);
  }

  /** Open chat: overlay (always works) or plugin page */
  async withNativeDialog(fn) {
    const ov = document.getElementById("witai-overlay");
    const fab = this.fabEl || document.getElementById("witai-fab");
    const snap = [];
    try {
      if (ov) {
        snap.push([ov, ov.style.zIndex, ov.style.pointerEvents]);
        ov.style.zIndex = "10";
        ov.style.pointerEvents = "none";
      }
      if (fab) {
        snap.push([fab, fab.style.zIndex, fab.style.pointerEvents]);
        fab.style.zIndex = "10";
        fab.style.pointerEvents = "none";
      }
      await new Promise((r) => setTimeout(r, 40));
      return await fn();
    } finally {
      for (const [el, z, pe] of snap) {
        try {
          el.style.zIndex = z || "";
          el.style.pointerEvents = pe || "";
        } catch { /* ignore */ }
      }
    }
  }

  async openChatUI() {
    const existing = document.getElementById("witai-overlay");
    if (existing) {
      existing.remove();
      this.panelOpen = false;
      return;
    }
    // Try focusing sidebar app if present (native panel)
    try {
      const side = document.querySelector(".sidebar .witai_star, [data-id=\"witai_sidebar\"], #witai_sidebar");
      if (side && typeof side.click === "function") side.click();
    } catch { /* ignore */ }
    // Full-screen overlay — does not depend on $page
    const ov = document.createElement("div");
    ov.id = "witai-overlay";
    Object.assign(ov.style, {
      position: "fixed",
      left: "0",
      top: "0",
      right: "0",
      bottom: "0",
      zIndex: "10040",
      background: "#121212",
      display: "flex",
      flexDirection: "column",
      pointerEvents: "auto",
    });
    const bar = document.createElement("div");
    bar.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#1e1e1e;border-bottom:1px solid #333;";
    bar.innerHTML =
      '<span style="color:#a29bfe;font-weight:700">WIT AI</span>';
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.style.cssText =
      "background:#333;color:#eee;border:none;border-radius:8px;padding:8px 14px;";
    close.onclick = () => {
      ov.remove();
      this.panelOpen = false;
    };
    bar.appendChild(close);
    const host = document.createElement("div");
    host.style.cssText = "flex:1;overflow:auto;min-height:0;";
    ov.appendChild(bar);
    ov.appendChild(host);
    document.body.appendChild(ov);
    this.panelOpen = true;
    try {
      await this.mountChatUI(host);
    } catch (e) {
      host.textContent = "Failed to load chat: " + (e.message || e);
    }
  }

  removeFab() {
    if (this.fabEl && this.fabEl.parentNode) {
      this.fabEl.parentNode.removeChild(this.fabEl);
    }
    this.fabEl = null;
    const existing = document.getElementById("witai-fab");
    if (existing) existing.remove();
  }

  storageKey(name) {
    return `witai_${plugin.id}_${name}`;
  }

  async storeGet(name, def = "") {
    const k = this.storageKey(name);
    // 1) encrypted ctx secrets
    if (this.ctx && typeof this.ctx.getSecret === "function") {
      try {
        const v = await this.ctx.getSecret(name, "");
        if (v !== undefined && v !== null && String(v) !== "") return String(v);
      } catch (e) {
        console.warn("WIT AI getSecret failed", e);
      }
    }
    // 2) localStorage fallback (persists when ctx is null)
    try {
      const v = localStorage.getItem(k);
      if (v !== null && v !== "") return v;
    } catch { /* private mode */ }
    return def;
  }

  async storeSet(name, value) {
    const val = String(value ?? "");
    const k = this.storageKey(name);
    let ok = false;
    if (this.ctx && typeof this.ctx.setSecret === "function") {
      try {
        await this.ctx.setSecret(name, val);
        ok = true;
      } catch (e) {
        console.warn("WIT AI setSecret failed", e);
      }
    }
    try {
      localStorage.setItem(k, val);
      ok = true;
    } catch (e) {
      console.warn("WIT AI localStorage failed", e);
    }
    return ok;
  }

  async getKey(provider) {
    return this.storeGet(`${provider}_api_key`, "");
  }
  async setKey(provider, key) {
    const ok = await this.storeSet(`${provider}_api_key`, key || "");
    if (!ok) throw new Error("Could not save key (storage unavailable)");
    // verify
    const check = await this.getKey(provider);
    if ((key || "") && check !== (key || "").trim() && check !== key) {
      // allow trim mismatch only if both empty
      console.warn("WIT AI key verify mismatch");
    }
    return ok;
  }
  async getSetting(key, def = "") {
    return this.storeGet(`setting_${key}`, def);
  }
  async setSetting(key, value) {
    return this.storeSet(`setting_${key}`, String(value ?? ""));
  }

  safeToast(msg) {
    const text = String(msg || "");
    try {
      const toastFn = acode && acode.toast;
      if (typeof toastFn === "function") {
        toastFn.call(acode, text);
        return;
      }
    } catch (e) {
      console.warn("WIT AI toast", e);
    }
    try {
      const push = acode && acode.pushNotification;
      if (typeof push === "function") {
        push.call(acode, "WIT AI", text, { type: "info", autoClose: true });
        return;
      }
    } catch (e) {
      console.warn("WIT AI notify", e);
    }
    try {
      if (typeof window !== "undefined" && typeof window.toast === "function") {
        window.toast(text);
        return;
      }
    } catch { /* ignore */ }
    try {
      if (typeof acode !== "undefined" && typeof acode.alert === "function" && text.length < 80) {
        // last resort only for short messages — avoid modal spam
      }
    } catch { /* ignore */ }
    console.log("WIT AI:", text);
  }

    async promptKey(label) {
    // Avoid password-type prompts that show blank on some Acode builds
    const key = await acode.prompt(label + " — paste key, then OK", "");
    if (key === null || key === undefined) return null;
    return String(key).trim();
  }

  getCurrentContext() {
    try {
      const editor = editorManager.editor;
      const file = editorManager.activeFile;
      const fullText = editor.state.doc.toString();
      const sel = editor.state.selection.main;
      const selection = sel.from !== sel.to ? editor.state.sliceDoc(sel.from, sel.to) : null;
      return {
        filename: file?.filename || "untitled",
        uri: file?.uri || "",
        language: this.guessLanguage(file?.filename),
        fullText,
        selection,
        cursor: sel.head,
        hasSelection: !!selection,
      };
    } catch {
      return { filename: "untitled", uri: "", language: "text", fullText: "", selection: null, cursor: 0, hasSelection: false };
    }
  }

  getWorkspaceFolder() {
    try {
      try {
        const added = acode.require("addedfolder");
        if (added && added.length && added[0] && added[0].url) return added[0].url;
      } catch (e) { /* older builds */ }
      if (window.addedFolder && window.addedFolder[0] && window.addedFolder[0].url) {
        return window.addedFolder[0].url;
      }
      const file = editorManager && editorManager.activeFile;
      if (file && file.location) return String(file.location).replace(/\/?$/, "");
      const uri = (file && (file.uri || file.url)) || "";
      if (uri) {
        const cut = uri.replace(/\/[^/]+$/, "");
        if (cut && cut !== uri) return cut;
      }
    } catch (e) { /* ignore */ }
    return "";
  }

  joinUrl(folderUrl, relPath) {
    const rel = String(relPath || "").replace(/^\/+/, "").replace(/\\/g, "/");
    let base = String(folderUrl || "").replace(/\/+$/, "");
    if (!base) return rel;
    try {
      const Url = acode.require("url");
      if (Url && Url.join) return Url.join(base, rel);
    } catch (e) { /* */ }
    return base + "/" + rel;
  }


  async getProjectTreeSummary(maxLines = 80) {
    const folderUrl = this.getWorkspaceFolder();
    if (!folderUrl) return { folderUrl: "", summary: "(no project folder open in Acode sidebar)" };
    try {
      const tree = await this.listDir(folderUrl, 2);
      const flat = this.flattenTree(tree).slice(0, maxLines);
      return { folderUrl, summary: flat.join("\n") || "(empty folder)" };
    } catch {
      return { folderUrl, summary: "(could not list folder)" };
    }
  }

  async loadSessions() {
    try {
      const raw = await this.getSetting("sessions_json", "");
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) this.sessions = list;
      }
      const cur = await this.getSetting("current_session_id", "");
      if (cur) this.currentSessionId = cur;
      if (!this.sessions.length) {
        const id = "s_" + Date.now();
        this.sessions = [{ id, name: "Main", history: this.history.slice(-40), folderUrl: this.getWorkspaceFolder(), updated: Date.now() }];
        this.currentSessionId = id;
      }
      if (!this.currentSessionId || !this.sessions.find((s) => s.id === this.currentSessionId)) {
        this.currentSessionId = this.sessions[0].id;
      }
      const sess = this.sessions.find((s) => s.id === this.currentSessionId);
      if (sess && Array.isArray(sess.history)) this.history = sess.history;
    } catch (e) {
      console.warn("loadSessions", e);
    }
  }

  async saveSessions() {
    try {
      const sess = this.sessions.find((s) => s.id === this.currentSessionId);
      if (sess) {
        sess.history = this.history.slice(-40);
        sess.folderUrl = this.getWorkspaceFolder() || sess.folderUrl || "";
        sess.updated = Date.now();
      }
      await this.setSetting("sessions_json", JSON.stringify(this.sessions.slice(-20)));
      await this.setSetting("current_session_id", this.currentSessionId || "");
      await this.persistHistory();
    } catch (e) {
      console.warn("saveSessions", e);
    }
  }

  async newSession(name) {
    await this.saveSessions();
    const id = "s_" + Date.now();
    const folderUrl = this.getWorkspaceFolder();
    const label = name || ("Chat " + (this.sessions.length + 1));
    this.sessions.unshift({ id, name: label, history: [], folderUrl, updated: Date.now() });
    this.currentSessionId = id;
    this.history = [];
    await this.saveSessions();
    return id;
  }

  async switchSession(id) {
    await this.saveSessions();
    const sess = this.sessions.find((s) => s.id === id);
    if (!sess) return;
    this.currentSessionId = id;
    this.history = Array.isArray(sess.history) ? sess.history.slice() : [];
    await this.setSetting("current_session_id", id);
    await this.persistHistory();
  }

    guessLanguage(filename = "") {
    const ext = (filename.split(".").pop() || "").toLowerCase();
    const map = {
      js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
      py: "python", java: "java", kt: "kotlin", go: "go", rs: "rust", php: "php",
      rb: "ruby", css: "css", scss: "scss", html: "html", htm: "html", json: "json",
      md: "markdown", sh: "bash", bash: "bash", c: "c", cpp: "cpp", h: "c",
      vue: "vue", svelte: "svelte", xml: "xml", yaml: "yaml", yml: "yaml",
    };
    return map[ext] || "text";
  }

  async listDir(url, maxDepth = 2, depth = 0) {
    if (depth > maxDepth) return [];
    const out = [];
    if (depth === 0) {
      try {
        const fileIndex = acode.require("fileIndex");
        if (fileIndex && typeof fileIndex.supports === "function" && fileIndex.supports(url)) {
          if (typeof fileIndex.scan === "function") await fileIndex.scan(url);
          const res = await fileIndex.query({ roots: [url], text: "", limit: 200 });
          const entries = (res && res.entries) || [];
          if (entries.length) {
            for (const e of entries) {
              const name = e.name || String(e.path || "").split("/").pop();
              if (!name) continue;
              out.push({
                name: name,
                type: e.isDirectory ? "dir" : "file",
                url: e.url,
                rel: String(e.path || name).replace(/^\/+/, ""),
              });
            }
            if (out.length) return out;
          }
        }
      } catch (e) { /* fall through */ }
    }
    try {
      const fs = acode.require("fs");
      const dir = await fs(url);
      const entries = await dir.lsDir();
      for (const e of entries) {
        if (e.isDirectory) {
          out.push({
            name: e.name,
            type: "dir",
            url: e.url,
            children: await this.listDir(e.url, maxDepth, depth + 1),
          });
        } else {
          out.push({ name: e.name, type: "file", url: e.url });
        }
      }
    } catch (e) {
      return out;
    }
    return out;
  }

  flattenTree(tree, prefix = "") {
    let lines = [];
    for (const n of tree) {
      const p = prefix + n.name + (n.type === "dir" ? "/" : "");
      lines.push(p);
      if (n.children) lines = lines.concat(this.flattenTree(n.children, prefix + n.name + "/"));
    }
    return lines;
  }

  normalizeChatUrl(base) {
    let u = String(base || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    u = u.replace(/\/+$/, "");
    if (!/\/chat\/completions$/i.test(u)) {
      if (!/\/v1$/i.test(u) && !/\/openai$/i.test(u) && !/\/v1beta\/openai$/i.test(u)) {
        u += "/v1";
      }
      u += "/chat/completions";
    }
    return u;
  }

  async resolveEndpoint() {
    const provider = await this.getSetting("provider", "groq");
    let model = await this.getSetting("model", "");
    const baseUrl = await this.getSetting("base_url", "");
    if (!model || model === "custom") {
      model = provider === "groq" ? "openai/gpt-oss-20b"
        : provider === "openai" ? "gpt-4o-mini"
        : provider === "anthropic" ? "claude-sonnet-5-5"
        : provider === "gemini" ? "gemini-3.8-flash"
        : provider === "huggingface" ? "meta-llama/Llama-3.1-8B-Instruct"
        : "gpt-4o-mini";
    }
    let url, keyProvider;
    if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      keyProvider = "groq";
    } else if (provider === "openai") {
      url = "https://api.openai.com/v1/chat/completions";
      keyProvider = "openai";
    } else if (provider === "anthropic") {
      // Anthropic OpenAI-compat layer (chat completions)
      url = "https://api.anthropic.com/v1/chat/completions";
      keyProvider = "anthropic";
    } else if (provider === "gemini") {
      url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      keyProvider = "gemini";
    } else if (provider === "huggingface") {
      url = "https://router.huggingface.co/v1/chat/completions";
      keyProvider = "huggingface";
    } else {
      url = this.normalizeChatUrl(baseUrl || "https://api.openai.com/v1");
      keyProvider = "openai_compatible";
    }
    const key = await this.getKey(keyProvider);
    return { provider, model, url, key, keyProvider };
  }

  authHeaders(key, provider) {
    const h = { "Content-Type": "application/json" };
    if (key) h.Authorization = `Bearer ${key}`;
    // Anthropic OpenAI-compat often wants version header too
    if (provider === "anthropic") h["anthropic-version"] = "2023-06-01";
    return h;
  }

  isChatModelId(id) {
    if (!id || typeof id !== "string") return false;
    const s = id.toLowerCase().replace(/^models\//, "");
    const deny = [
      "whisper", "tts", "embedding", "embed", "image", "imagen", "veo",
      "live", "transcribe", "realtime", "audio", "video", "dall-e", "dalle",
      "moderation", "guard", "prompt-guard", "orpheus", "computer-use",
      "nano-banana", "speech", "asr", "tts-", "-tts", "vision", "robotics",
      "compound", "allam", "playai", "safeguard",
    ];
    if (deny.some((d) => s.includes(d))) return false;
    // Gemini text chat only
    if (s.startsWith("gemini-")) {
      return (s.includes("flash") || s.includes("pro")) && !s.includes("lite-tts");
    }
    if (s.startsWith("claude-")) return true;
    if (/^(gpt-|o[1-9]|chatgpt-|openai\/gpt-oss)/.test(s)) return true;
    if (/llama-3|llama-4|gpt-oss|qwen3|gemma2|mixtral|deepseek|kimi-k2/.test(s)) return true;
    // Explicit chat-capable HF ids only (narrow)
    if (/meta-llama\/llama-3|qwen\/qwen|mistralai\/|google\/gemma/.test(s)) return true;
    return false;
  }

  async fetchRemoteModels() {
    try {
      const { url, key, provider } = await this.resolveEndpoint();
      if (!key) return [];
      const headers = this.authHeaders(key, provider);
      delete headers["Content-Type"];

      const candidates = [];
      const modelsUrl = url.replace(/\/chat\/completions\/?$/, "/models");
      candidates.push(modelsUrl);
      // Gemini native list (returns models/gemini-…)
      if (provider === "gemini") {
        candidates.push("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key));
      }

      let list = [];
      for (const modelsUrlTry of candidates) {
        try {
          const h = { ...headers };
          // native Gemini list uses key query param; still ok with Bearer
          const res = await fetch(modelsUrlTry, { headers: h });
          if (!res.ok) continue;
          const data = await res.json();
          const raw = data.data || data.models || [];
          list = raw
            .map((m) => {
              let id = m.id || m.name || "";
              if (typeof id !== "string") return null;
              id = id.replace(/^models\//, "");
              if (!this.isChatModelId(id)) return null;
              return { id, label: id };
            })
            .filter(Boolean);
          if (list.length) break;
        } catch { /* try next */ }
      }

      // de-dupe + sort
      const seen = new Set();
      list = list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
      list.sort((a, b) => a.id.localeCompare(b.id));
      return list.slice(0, 60);
    } catch {
      return [];
    }
  }

  async getProfiles() {
    try {
      const raw = await this.getSetting("profiles_json", "");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async saveProfiles(list) {
    await this.setSetting("profiles_json", JSON.stringify(list || []));
  }

  async manageProfiles() {
    const profiles = await this.getProfiles();
    const choice = await acode.select("Profiles", [
      "Save current as profile",
      "Load profile",
      "Delete profile",
      "Back",
    ]);
    if (choice === "Save current as profile") {
      const name = await acode.prompt("Profile name", "My setup");
      if (!name) return;
      const snap = {
        name: name.trim(),
        provider: await this.getSetting("provider", "groq"),
        model: await this.getSetting("model", ""),
        base_url: await this.getSetting("base_url", ""),
      };
      const next = profiles.filter((p) => p.name !== snap.name).concat([snap]);
      await this.saveProfiles(next);
      this.safeToast("Profile saved: " + snap.name);
    } else if (choice === "Load profile") {
      if (!profiles.length) return this.safeToast("No profiles");
      const name = await acode.select("Load", profiles.map((p) => p.name));
      const p = profiles.find((x) => x.name === name);
      if (!p) return;
      await this.setSetting("provider", p.provider || "groq");
      await this.setSetting("model", p.model || "");
      await this.setSetting("base_url", p.base_url || "");
      this.safeToast("Loaded " + p.name);
    } else if (choice === "Delete profile") {
      if (!profiles.length) return;
      const name = await acode.select("Delete", profiles.map((p) => p.name));
      if (!name) return;
      await this.saveProfiles(profiles.filter((p) => p.name !== name));
      this.safeToast("Deleted " + name);
    }
  }


  async clearCurrentChatHistory() {
    this.history = [];
    await this.saveSessions();
    await this.persistHistory();
  }

  async deleteHistoryMessage(index) {
    if (index < 0 || index >= this.history.length) return false;
    this.history.splice(index, 1);
    await this.saveSessions();
    await this.persistHistory();
    return true;
  }

  async deleteSessionById(id) {
    if (!id) return;
    this.sessions = (this.sessions || []).filter((s) => s.id !== id);
    if (!this.sessions.length) {
      await this.newSession("Main");
      return;
    }
    if (this.currentSessionId === id) {
      await this.switchSession(this.sessions[0].id);
    } else {
      await this.saveSessions();
    }
  }

  async persistHistory() {
    try {
      const slim = this.history.slice(-40).map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, 8000),
      }));
      await this.setSetting("chat_history_json", JSON.stringify(slim));
    } catch { /* ignore */ }
  }

  async loadHistory() {
    try {
      const raw = await this.getSetting("chat_history_json", "");
      if (!raw) return;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) this.history = list;
    } catch { /* ignore */ }
  }

  toastUsage(usage) {
    try {
      if (!usage) return;
      const p = usage.prompt_tokens ?? usage.input_tokens;
      const c = usage.completion_tokens ?? usage.output_tokens;
      const tot = usage.total_tokens;
      if (p != null || c != null || tot != null) {
        this.safeToast(`Tokens: ${p ?? "?"} in / ${c ?? "?"} out` + (tot != null ? ` (${tot} total)` : ""));
      }
    } catch (e) {
      console.warn("toastUsage", e);
    }
  }

  stripHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  async fetchUrlText(url) {
    const res = await fetch(url, { headers: { Accept: "text/html,application/json,text/plain" } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const ct = res.headers.get("content-type") || "";
    const raw = await res.text();
    if (ct.includes("application/json")) {
      try { return JSON.stringify(JSON.parse(raw)).slice(0, 6000); } catch { return raw.slice(0, 6000); }
    }
    return this.stripHtml(raw).slice(0, 6000);
  }

  async fetchJson(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { Accept: "application/json,text/plain,*/*" },
      });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async postJson(url, body, headers = {}, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok) {
        const err = new Error((data && (data.error || data.message)) || text.slice(0, 200) || String(res.status));
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async searchTavily(query) {
    const key = (await this.getKey("tavily") || "").trim();
    const headers = {};
    if (key) headers.Authorization = "Bearer " + key;
    else headers["X-Tavily-Access-Mode"] = "keyless";
    const data = await this.postJson("https://api.tavily.com/search", {
      query: String(query).slice(0, 400),
      max_results: 5,
      search_depth: "basic",
      include_answer: true,
    }, headers);
    const parts = ["[Tavily]"];
    if (data.answer) parts.push("Answer: " + String(data.answer).slice(0, 1500));
    const results = data.results || [];
    for (const r of results.slice(0, 5)) {
      const title = r.title || r.url || "result";
      const url = r.url || "";
      const content = (r.content || r.snippet || "").slice(0, 400);
      parts.push(`- ${title}${url ? " — " + url : ""}`);
      if (content) parts.push("  " + content);
    }
    return parts.length > 1 ? parts.join("\n") : "";
  }

  async searchFirecrawl(query) {
    const key = (await this.getKey("firecrawl") || "").trim();
    const headers = {};
    if (key) headers.Authorization = "Bearer " + key;
    // Keyless: no Authorization header (Firecrawl Keyless)
    const body = {
      query: String(query).slice(0, 400),
      limit: 5,
    };
    let data = null;
    // Prefer v1 (widely documented); fall back to v2
    try {
      data = await this.postJson("https://api.firecrawl.dev/v1/search", body, headers);
    } catch (e1) {
      try {
        data = await this.postJson("https://api.firecrawl.dev/v2/search", body, headers);
      } catch (e2) {
        throw e1;
      }
    }
    const parts = ["[Firecrawl]"];
    const results = data.data || data.results || data.web || [];
    const list = Array.isArray(results) ? results : (results.web || []);
    for (const r of (list || []).slice(0, 5)) {
      const title = r.title || r.metadata?.title || r.url || "result";
      const url = r.url || r.metadata?.sourceURL || "";
      const desc = (r.description || r.markdown || r.content || "").toString().slice(0, 400);
      parts.push(`- ${title}${url ? " — " + url : ""}`);
      if (desc) parts.push("  " + desc);
    }
    if (data.answer) parts.push("Answer: " + String(data.answer).slice(0, 1000));
    return parts.length > 1 ? parts.join("\n") : "";
  }

  async webSearch(query) {
    const qRaw = String(query || "").slice(0, 200);
    const q = encodeURIComponent(qRaw);
    const parts = [];
    const today = new Date().toISOString().slice(0, 10);
    parts.push("Date (UTC): " + today);

    // 0) Prefer AI search APIs (Tavily → Firecrawl) when available / keyless
    try {
      const tav = await this.searchTavily(qRaw);
      if (tav) parts.push(tav);
    } catch (e) {
      parts.push("[Tavily] " + (e.message || "failed").slice(0, 120));
    }
    // If Tavily already gave solid results, still try Firecrawl only if Tavily failed hard
    const hasTavily = parts.some((p) => p.startsWith("[Tavily]") && !p.includes("failed") && p.includes("\n"));
    if (!hasTavily) {
      try {
        const fc = await this.searchFirecrawl(qRaw);
        if (fc) parts.push(fc);
      } catch (e) {
        parts.push("[Firecrawl] " + (e.message || "failed").slice(0, 120));
      }
    } else {
      // Optional second source for coding/docs queries
      if (/\b(docs?|api|sdk|github|npm|mdn|spec)\b/i.test(qRaw)) {
        try {
          const fc = await this.searchFirecrawl(qRaw);
          if (fc) parts.push(fc);
        } catch { /* ignore */ }
      }
    }

    // 1) Wikipedia OpenSearch + summary
    try {
      const wiki = await this.fetchJson(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=5&namespace=0&format=json&origin=*`
      );
      if (Array.isArray(wiki) && wiki[1]?.length) {
        parts.push("Wikipedia matches:");
        for (let i = 0; i < Math.min(5, wiki[1].length); i++) {
          const title = wiki[1][i];
          const url = wiki[3]?.[i] || "";
          parts.push(`- ${title}${url ? " — " + url : ""}`);
        }
        const top = wiki[1][0];
        if (top) {
          try {
            const sum = await this.fetchJson(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top)}`
            );
            if (sum?.extract) parts.push("Summary: " + sum.extract.slice(0, 1200));
            if (sum?.content_urls?.desktop?.page) parts.push("Source: " + sum.content_urls.desktop.page);
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    // 2) DuckDuckGo Instant Answer
    try {
      const data = await this.fetchJson(
        `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`
      );
      if (data?.AbstractText) parts.push(data.AbstractText);
      if (data?.Heading) parts.push("Topic: " + data.Heading);
      if (Array.isArray(data?.RelatedTopics)) {
        for (const t of data.RelatedTopics.slice(0, 6)) {
          if (t.Text) parts.push("- " + t.Text);
          else if (t.Topics) {
            for (const s of t.Topics.slice(0, 3)) if (s.Text) parts.push("- " + s.Text);
          }
        }
      }
      if (data?.AbstractURL) parts.push("Source: " + data.AbstractURL);
    } catch { /* ignore */ }

    // 3) Wikinews for news-ish queries
    if (/\b(news|today|headline|breaking|latest)\b/i.test(query)) {
      try {
        const news = await this.fetchJson(
          `https://en.wikinews.org/w/api.php?action=opensearch&search=${q}&limit=5&namespace=0&format=json&origin=*`
        );
        if (Array.isArray(news) && news[1]?.length) {
          parts.push("Wikinews:");
          for (let i = 0; i < Math.min(5, news[1].length); i++) {
            parts.push(`- ${news[1][i]}${news[3]?.[i] ? " — " + news[3][i] : ""}`);
          }
        }
      } catch { /* ignore */ }
    }

    // 4) CORS proxy DDG HTML last resort if almost empty
    const useful = parts.filter((p) => !p.startsWith("Date") && !p.includes("failed")).length;
    if (useful <= 1) {
      try {
        const target = encodeURIComponent(`https://html.duckduckgo.com/html/?q=${q}`);
        const proxied = await fetch(`https://api.allorigins.win/raw?url=${target}`);
        if (proxied.ok) {
          const html = await proxied.text();
          const plain = this.stripHtml(html).slice(0, 2500);
          if (plain) parts.push(plain);
        }
      } catch { /* ignore */ }
    }

    const text = parts.filter(Boolean).join("\n").trim();
    return text || "(no web results — set Tavily/Firecrawl key in Settings, or paste a URL)";
  }


  /**
   * Read project files named in the user message (and small-project "check files" requests).
   * Returns a context string the model must treat as real file contents.
   */
  async loadProjectFilesForMessage(userText) {
    const folderUrl = this.getWorkspaceFolder();
    if (!folderUrl) {
      return "\n\n(No project folder detected. Open the project folder in Acode's file sidebar so WIT AI can read app.js and other files.)\n";
    }

    const text = String(userText || "");
    let tree = [];
    try {
      tree = await this.listDir(folderUrl, 3);
    } catch (e) {
      return "\n\n(Could not list project folder: " + (e.message || e) + ")\n";
    }

    const flat = [];
    const walk = (nodes, prefix) => {
      for (const n of nodes || []) {
        const rel = n.rel || ((prefix ? prefix + "/" : "") + n.name);
        if (n.type === "file" || (!n.children && n.url && n.name)) {
          flat.push({ name: n.name, rel: String(rel).replace(/^\/+/, ""), url: n.url });
        }
        if (n.children) walk(n.children, rel);
      }
    };
    walk(tree, "");

    const lower = text.toLowerCase();
    const mentioned = new Set();
    const common = ["app.js", "index.html", "styles.css", "style.css", "main.js", "script.js", "README.md", "package.json"];

    for (const f of flat) {
      if (lower.includes(f.name.toLowerCase()) || lower.includes(f.rel.toLowerCase())) {
        mentioned.add(f.rel);
      }
    }
    for (const c of common) {
      if (lower.includes(c.toLowerCase())) mentioned.add(c);
    }

    const checkAll =
      /\b(check|read|open|inspect|review|look at|verify|diagnose|fix|debug|invalid\s*date)\b/i.test(text);
    if (checkAll) {
      for (const f of flat) {
        if (!/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp3|mp4|zip|pdf)$/i.test(f.name)) {
          mentioned.add(f.rel);
        }
      }
      for (const c of ["app.js", "index.html", "styles.css", "style.css"]) mentioned.add(c);
    }

    if (!mentioned.size && flat.length && flat.length <= 10) {
      for (const f of flat) mentioned.add(f.rel);
    }

    if (!mentioned.size) {
      return "\n\nProject folder: " + folderUrl + "\nFiles seen: " + (flat.map((f) => f.rel).join(", ") || "(none)") + "\n";
    }

    const fs = acode.require("fs");
    const parts = [
      "\n\n--- Project files loaded by WIT AI from disk (folder: " + folderUrl + ") ---",
      "You HAVE these file contents. Never say you cannot read them. When fixing, tag code fences with the real path (e.g. app.js).",
    ];
    let total = 0;
    const loaded = [];
    for (const rel of [...mentioned].slice(0, 10)) {
      const f = flat.find((x) => x.rel === rel || x.name === rel || x.rel.endsWith("/" + rel));
      const url = (f && f.url) || this.joinUrl(folderUrl, rel);
      try {
        let content = await (await fs(url)).readFile("utf-8");
        content = String(content == null ? "" : content);
        if (content.length > 16000) content = content.slice(0, 16000) + "\n/* …truncated */";
        total += content.length;
        if (total > 60000) {
          parts.push("\n(file " + rel + " skipped — context budget)");
          break;
        }
        loaded.push(rel);
        parts.push("\n### FILE: " + rel + "\n```\n" + content + "\n```");
      } catch (e) {
        parts.push("\n### FILE: " + rel + "\n(read failed: " + (e.message || e) + ")");
      }
    }
    parts.push(
      "\n--- End project files (" + loaded.length + " loaded). PATCH the correct path; do not put app.js code into index.html. ---\n"
    );
    return parts.join("");
  }

  async maybeWebContext(userText) {
    const enabled = await this.getSetting("web_enabled", "1");
    if (enabled === "0" || enabled === "false") {
      if (!this.webForceOn) return "";
    }
    const looksCurrent = /\b(latest|current|today|news|headline|202[4-9]|standard|docs?|mdn|spec|RFC|how to|official|price|release)\b/i.test(userText)
      || /^https?:\/\//i.test(userText);
    if (!this.webForceOn && !looksCurrent && enabled !== "always") return "";
    try {
      const urlMatch = userText.match(/https?:\/\/[^\s)]+/);
      if (urlMatch) {
        let body = "";
        // Prefer Tavily extract when key/keyless works
        try {
          const key = (await this.getKey("tavily") || "").trim();
          const headers = {};
          if (key) headers.Authorization = "Bearer " + key;
          else headers["X-Tavily-Access-Mode"] = "keyless";
          const data = await this.postJson("https://api.tavily.com/extract", {
            urls: [urlMatch[0]],
          }, headers);
          const r0 = (data.results || [])[0];
          if (r0?.raw_content || r0?.content) {
            body = String(r0.raw_content || r0.content).slice(0, 6000);
          }
        } catch { /* fall through */ }
        if (!body) {
          try {
            body = await this.fetchUrlText(urlMatch[0]);
          } catch {
            try {
              const proxied = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(urlMatch[0]));
              if (proxied.ok) body = this.stripHtml(await proxied.text()).slice(0, 6000);
            } catch { /* ignore */ }
          }
        }
        return `\n\nWeb page (${urlMatch[0]}):\n${body || "(could not fetch page)"}`;
      }
      const body = await this.webSearch(userText.slice(0, 200));
      return `\n\nLive web context:\n${body}`;
    } catch (e) {
      return `\n\n(Web lookup failed: ${e.message})`;
    }
  }

  async getMcpConfig() {
    const raw = await this.getSetting("mcp_json", "");
    if (!raw) return { servers: [] };
    try { return JSON.parse(raw); } catch { return { servers: [] }; }
  }

  async saveMcpConfig(cfg) {
    await this.setSetting("mcp_json", JSON.stringify(cfg || { servers: [] }));
  }

  async mcpRpc(server, method, params = {}, id = 1) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (server.key) headers.Authorization = `Bearer ${server.key}`;
    const res = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`MCP ${res.status}: ${text.slice(0, 240)}`);
    // streamable HTTP may return SSE
    if (text.startsWith("event:") || text.includes("data:")) {
      const lines = text.split("\n").filter((l) => l.startsWith("data:"));
      const last = lines.pop();
      if (last) return JSON.parse(last.slice(5).trim());
    }
    return JSON.parse(text);
  }

  async mcpInitialize(server) {
    const init = await this.mcpRpc(server, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "WIT AI", version: "1.4.15" },
    });
    try { await this.mcpRpc(server, "notifications/initialized", {}, null); } catch { /* optional */ }
    return init;
  }

  async mcpListTools(server) {
    await this.mcpInitialize(server);
    const out = await this.mcpRpc(server, "tools/list", {}, 2);
    return out?.result?.tools || out?.tools || [];
  }

  async mcpCallTool(server, name, args = {}) {
    await this.mcpInitialize(server);
    const out = await this.mcpRpc(server, "tools/call", { name, arguments: args }, 3);
    const result = out?.result || out;
    const content = result?.content;
    if (Array.isArray(content)) {
      return content.map((c) => c.text || JSON.stringify(c)).join("\n");
    }
    return JSON.stringify(result).slice(0, 8000);
  }

  async configureMcp() {
    const cfg = await this.getMcpConfig();
    const choice = await acode.select("MCP / services", [
      "Add HTTP MCP server",
      "List saved servers",
      "Test server (tools/list)",
      "Call a tool",
      "Remove a server",
      "Back",
    ]);
    if (choice === "Add HTTP MCP server") {
      const name = await acode.prompt("Server name", "my-mcp");
      if (!name) return;
      const url = await acode.prompt("MCP URL (HTTPS JSON-RPC)", "https://example.com/mcp");
      if (!url) return;
      const key = await acode.prompt("Bearer token (optional)", "", true);
      cfg.servers = cfg.servers.filter((s) => s.name !== name);
      cfg.servers.push({ name: name.trim(), url: url.trim(), key: (key || "").trim() });
      await this.saveMcpConfig(cfg);
      this.safeToast("MCP server saved");
    } else if (choice === "List saved servers") {
      const names = (cfg.servers || []).map((s) => `${s.name}\n${s.url}`);
      acode.alert("MCP servers", names.join("\n\n") || "(none)");
    } else if (choice === "Test server (tools/list)") {
      if (!cfg.servers?.length) return this.safeToast("No MCP servers");
      const picked = await acode.select("Server", cfg.servers.map((s) => s.name));
      const server = cfg.servers.find((s) => s.name === picked);
      if (!server) return;
      try {
        acode.loader?.show?.("Listing MCP tools…");
        const tools = await this.mcpListTools(server);
        acode.loader?.hide?.();
        acode.alert(
          server.name,
          tools.length
            ? tools.map((t) => `• ${t.name}\n  ${t.description || ""}`).join("\n\n")
            : "Connected, but no tools advertised."
        );
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("MCP error", e.message + "\n\nHTTP MCP servers need CORS + JSON-RPC. Stdio MCP cannot run inside Acode.");
      }
    } else if (choice === "Call a tool") {
      if (!cfg.servers?.length) return this.safeToast("No MCP servers");
      const picked = await acode.select("Server", cfg.servers.map((s) => s.name));
      const server = cfg.servers.find((s) => s.name === picked);
      if (!server) return;
      try {
        acode.loader?.show?.("Loading tools…");
        const tools = await this.mcpListTools(server);
        acode.loader?.hide?.();
        if (!tools.length) return this.safeToast("No tools");
        const tname = await acode.select("Tool", tools.map((t) => t.name));
        if (!tname) return;
        const argsRaw = await acode.prompt("Arguments JSON", "{}");
        let args = {};
        try { args = JSON.parse(argsRaw || "{}"); } catch { return acode.alert("WIT AI", "Invalid JSON"); }
        const ok = await acode.confirm(`Call ${tname} on ${server.name}?`);
        if (!ok) return;
        acode.loader?.show?.("Calling tool…");
        const result = await this.mcpCallTool(server, tname, args);
        acode.loader?.hide?.();
        this.history.push({ role: "user", content: `MCP ${server.name}.${tname} →\n${result}` });
        acode.alert("MCP result", String(result).slice(0, 3000));
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("MCP error", e.message);
      }
    } else if (choice === "Remove a server") {
      if (!cfg.servers?.length) return;
      const picked = await acode.select("Remove", cfg.servers.map((s) => s.name));
      if (!picked) return;
      cfg.servers = cfg.servers.filter((s) => s.name !== picked);
      await this.saveMcpConfig(cfg);
      this.safeToast("Removed " + picked);
    }
  }

  async callLLM(messages, options = {}) {
    const { model, url, key, provider } = await this.resolveEndpoint();
    if (!key) throw new Error("No API key saved for " + provider + ". Settings → set " + provider + " key (paste full key, then OK).");
    if (!key) {
      acode.alert("WIT AI", "No API key set for the current provider.\nOpen Settings to add one.");
      return null;
    }
    const body = {
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 8192,
      stream: false,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: this.authHeaders(key, provider),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(this.formatApiError(res.status, errText, provider, body.model));
    }
    const data = await res.json();
    this.lastUsage = data.usage || null;
    try { this.toastUsage(this.lastUsage); } catch (_) {}
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  formatApiError(status, errText, provider, model) {
    let msg = `API error (${status}): ${String(errText).slice(0, 350)}`;
    const low = String(errText).toLowerCase();
    if (status === 503 || low.includes("high demand") || low.includes("unavailable")) {
      msg += "\n\nTip: Provider is overloaded. Retry later, or switch model (Gemini: try gemini-2.5-flash).";
    } else if (status === 404 || low.includes("model_not_found") || low.includes("does not exist")) {
      msg += `\n\nTip: Model "${model}" not available on this ${provider} key/plan. Pick another model (Groq: llama-3.1-8b-instant).`;
    } else if (status === 401 || status === 403) {
      msg += `\n\nTip: Check the ${provider} API key in Settings.`;
    } else if (status === 429) {
      msg += "\n\nTip: Rate limit — wait a minute or use a lighter model.";
    }
    return msg;
  }

  async callLLMStream(messages, onChunk, options = {}) {
    const { model, url, key, provider } = await this.resolveEndpoint();
    if (!key) throw new Error("No API key saved for " + provider + ". Settings → set " + provider + " key (paste full key, then OK).");
    if (!key) {
      acode.alert("WIT AI", "No API key set for the current provider.\nOpen Settings to add one.");
      return null;
    }
    this.abortController = new AbortController();
    this.isStreaming = true;
    const body = {
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 8192,
      stream: true,
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(key, provider),
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(this.formatApiError(res.status, errText, provider, body.model));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let full = "";
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) this.lastUsage = parsed.usage;
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              if (onChunk) onChunk(delta, full);
            }
          } catch { /* ignore */ }
        }
      }
      try { this.toastUsage(this.lastUsage); } catch (_) {}
      return full.trim();
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  stopStream() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.isStreaming = false;
    }
  }


  /** Write text into the active Acode editor (CodeMirror 6 + Ace compat). */
  setEditorContent(text, opts = {}) {
    const code = String(text ?? "");
    const editor = editorManager?.editor;
    if (!editor) throw new Error("No editor open");

    // CodeMirror 6 (current Acode)
    if (editor.state?.doc && typeof editor.dispatch === "function") {
      const from = opts.from != null ? opts.from : 0;
      const to = opts.to != null ? opts.to : editor.state.doc.length;
      editor.dispatch({ changes: { from, to, insert: code } });
    } else if (editor.session && typeof editor.session.setValue === "function") {
      editor.session.setValue(code);
    } else if (typeof editor.setValue === "function") {
      editor.setValue(code);
    } else if (typeof editor.insert === "function" && opts.insertOnly) {
      editor.insert(code);
    } else {
      throw new Error("Unsupported editor API");
    }

    try {
      const file = editorManager.activeFile;
      if (file) {
        if ("isUnsaved" in file) file.isUnsaved = true;
        if ("markChanged" in file) file.markChanged = true;
        if (typeof file.markAsChanged === "function") file.markAsChanged();
      }
    } catch { /* ignore */ }
    return true;
  }

  insertAtCursor(text) {
    const code = String(text ?? "");
    const editor = editorManager?.editor;
    if (!editor) throw new Error("No editor open");
    if (typeof editor.insert === "function") {
      editor.insert(code);
      return true;
    }
    if (editor.state?.selection?.main && typeof editor.dispatch === "function") {
      const pos = editor.state.selection.main.from;
      editor.dispatch({ changes: { from: pos, insert: code } });
      return true;
    }
    if (editor.session && typeof editor.session.insert === "function") {
      const pos = editor.getCursorPosition?.() || { row: 0, column: 0 };
      editor.session.insert(pos, code);
      return true;
    }
    // fallback: append
    return this.setEditorContent((editor.state?.doc?.toString?.() || "") + code);
  }


  async applyToActiveFile(content) {
    const code = String(content ?? "");
    if (!code) throw new Error("Empty content");
    // 1) Update editor buffer (CodeMirror / Ace)
    this.setEditorContent(code);
    // 2) Persist to disk if the tab has a URI
    const file = editorManager?.activeFile;
    const uri = file?.uri || file?.url || "";
    if (uri) {
      try {
        const fs = acode.require("fs");
        await (await fs(uri)).writeFile(code);
        try {
          if ("isUnsaved" in file) file.isUnsaved = false;
          if (typeof file.markUnsaved === "function") file.markUnsaved(false);
        } catch { /* ignore */ }
        this.safeToast("Saved " + (file.filename || file.name || "file"));
        return { editor: true, disk: true, uri };
      } catch (e) {
        this.safeToast("Editor updated (disk write failed: " + (e.message || e) + ")");
        return { editor: true, disk: false, error: e.message };
      }
    }
    this.safeToast("Updated editor (untitled — save manually)");
    return { editor: true, disk: false };
  }

  async writeProjectFile(relPath, content, folderUrl) {
    const fs = acode.require("fs");
    folderUrl = folderUrl || this.getWorkspaceFolder();
    const url = this.resolveProjectPath(folderUrl, relPath);
    // Try write; if missing, create
    try {
      await (await fs(url)).writeFile(content);
    } catch {
      const parent = url.replace(/\/[^/]+$/, "");
      const name = url.split("/").pop();
      try {
        await (await fs(parent)).createFile(name, content);
      } catch (e2) {
        await (await fs(url)).writeFile(content);
      }
    }
    // If that file is open, refresh editor buffer
    try {
      const active = editorManager.activeFile;
      const activeUri = active?.uri || active?.url || "";
      if (activeUri && (activeUri === url || activeUri.endsWith("/" + String(relPath).replace(/^\/+/, "")))) {
        this.setEditorContent(content);
      }
    } catch { /* ignore */ }
    return url;
  }


  /** Extract fenced code blocks; detect target path from info string or file: header. */
  extractCodeBlocks(text) {
    const blocks = [];
    const re = /```([^\n`]*)\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(String(text || "")))) {
      const info = (m[1] || "").trim();
      let content = m[2] || "";
      let path = "";
      // info string: "js src/app.js", "path=foo.py", "filename=a.html"
      const infoPath =
        info.match(/(?:path|file(?:name)?)\s*=\s*([^\s]+)/i) ||
        info.match(/([\w./\\-]+\.[a-zA-Z0-9]{1,12})\s*$/);
      if (infoPath) path = infoPath[1].replace(/\\/g, "/");
      // body headers
      const header = content.match(
        /^\s*(?:\/\/|#|\/\*|--|<!--)\s*(?:file\s*[:=]\s*|path\s*[:=]\s*)([^\s*]+)/i
      );
      if (header) {
        path = header[1].replace(/\\/g, "/").replace(/-->$/, "").trim();
        content = content.replace(
          /^\s*(?:\/\/|#|\/\*|--|<!--)\s*(?:file\s*[:=]\s*|path\s*[:=]\s*)([^\s*]+).*\n?/,
          ""
        );
      }
      // "File: src/x.js" prose line
      if (!path) {
        const prose = content.match(/^\s*File\s*:\s*([^\s]+)/i);
        if (prose) {
          path = prose[1].replace(/\\/g, "/");
          content = content.replace(/^\s*File\s*:\s*[^\s]+\s*\n?/, "");
        }
      }
      blocks.push({
        path: path.replace(/^\.\//, ""),
        content: content.replace(/\n$/, ""),
        lang: (info.split(/\s+/)[0] || ""),
      });
    }
    return blocks;
  }

  async applyBlockSmart(block, fullText) {
    const folderUrl = this.getWorkspaceFolder();
    const ctx = this.getCurrentContext();
    let path = (block.path || "").replace(/^\/+/, "").replace(/\\/g, "/");
    const content = block.content || "";
    if (!content.trim()) {
      this.safeToast("Empty code block");
      return;
    }

    // Infer path from surrounding reply if fence had no path
    if (!path && fullText) {
      const hint = String(fullText).match(
        /(?:FILE|file|path)\s*[:=]\s*[`']?([\w./\\-]+\.[a-zA-Z0-9]{1,12})/
      );
      if (hint) path = hint[1].replace(/\\/g, "/").replace(/^\/+/, "");
    }
    // Infer from language + common names in reply
    if (!path && fullText) {
      const lower = String(fullText).toLowerCase();
      for (const name of ["app.js", "styles.css", "style.css", "index.html", "main.js", "script.js"]) {
        if (lower.includes(name) && (block.lang || "").match(/js|javascript|css|html/i)) {
          // only if block looks like that file type
          const lang = (block.lang || "").toLowerCase();
          if (name.endsWith(".js") && /js|javascript|typescript/.test(lang || "js")) path = name;
          if (name.endsWith(".css") && /css/.test(lang)) path = name;
          if (name.endsWith(".html") && /html/.test(lang)) path = name;
          if (path) break;
        }
      }
    }

    // Path-tagged → ALWAYS write that project file, never the wrong open tab
    if (path && folderUrl) {
      const openName = (ctx.filename || "").toLowerCase();
      const base = path.split("/").pop().toLowerCase();
      const warn =
        openName && openName !== "untitled" && openName !== base
          ? "\n\n(Open tab is " + ctx.filename + " — writing " + path + " instead.)"
          : "";
      const ok = await this.withNativeDialog(() =>
        acode.confirm("Write to project file?\n\n" + path + warn)
      );
      if (!ok) return;
      try {
        await this.writeProjectFile(path, content, folderUrl);
        this.safeToast("Wrote " + path);
      } catch (e) {
        this.safeToast("Write failed: " + (e.message || e));
      }
      return;
    }

    // Path but no folder — refuse dumping into random open file
    if (path && !folderUrl) {
      this.safeToast("Open project folder to write " + path);
      await this.copyText(content);
      return;
    }

    // No path: ask explicitly — do not silently overwrite open file with wrong code
    const pick = await this.withNativeDialog(() =>
      acode.select("Apply code (no file path in block)", [
        "Write as: " + (ctx.filename || "open file"),
        "Insert at cursor",
        "Copy only",
        "Cancel",
      ])
    );
    if (!pick || pick === "Cancel") return;
    try {
      if (pick.startsWith("Write as:")) await this.applyToActiveFile(content);
      else if (pick === "Insert at cursor") {
        this.insertAtCursor(content);
        this.safeToast("Inserted");
      } else if (pick === "Copy only") await this.copyText(content);
    } catch (e) {
      this.safeToast("Apply failed: " + (e.message || e));
    }
  }

  /** Apply all path-tagged blocks from a reply automatically (with one confirm). */
  async applyAllTaggedBlocks(text) {
    const blocks = this.extractCodeBlocks(text).filter((b) => b.path);
    if (!blocks.length) return false;
    const list = blocks.map((b) => "• " + b.path).join("\n");
    const ok = await acode.confirm("Write " + blocks.length + " file(s) to the project?\n\n" + list);
    if (!ok) return false;
    const folderUrl = this.getWorkspaceFolder();
    if (!folderUrl) {
      this.safeToast("Open a project folder first");
      return false;
    }
    const results = [];
    for (const b of blocks) {
      try {
        await this.writeProjectFile(b.path, b.content, folderUrl);
        results.push("✓ " + b.path);
      } catch (e) {
        results.push("✗ " + b.path + ": " + e.message);
      }
    }
    acode.alert("WIT AI", results.join("\n"));
    return true;
  }

  stripCodeFences(text) {
    let s = String(text || "").trim();
    const m = s.match(/^```[\w+-]*\n?([\s\S]*?)```\s*$/);
    if (m) return m[1];
    // If multiple fences, prefer largest code block
    const blocks = [...s.matchAll(/```[\w+-]*\n?([\s\S]*?)```/g)].map((x) => x[1]);
    if (blocks.length === 1) return blocks[0];
    if (blocks.length > 1) return blocks.sort((a, b) => b.length - a.length)[0];
    return s;
  }

  async applyResult(result, ctx) {
    if (!result) return;
    const code = this.stripCodeFences(result);
    const action = await acode.select("WIT AI – Apply", [
      "Replace selection / whole file",
      "Insert at cursor",
      "Open in new tab",
      "Copy to clipboard",
      "Cancel",
    ]);
    if (!action || action === "Cancel") return;
    try {
      if (action === "Replace selection / whole file") {
        const editor = editorManager.editor;
        if (ctx.hasSelection && editor?.state?.selection?.main) {
          const from = editor.state.selection.main.from;
          const to = editor.state.selection.main.to;
          this.setEditorContent(code, { from, to });
          // also try disk if whole-file replace without selection would — selection stays buffer-only
          this.safeToast("Replaced selection");
        } else {
          await this.applyToActiveFile(code);
        }
      } else if (action === "Insert at cursor") {
        this.insertAtCursor("\n" + code + "\n");
        this.safeToast("Inserted");
      } else if (action === "Open in new tab") {
        const EditorFile = acode.require("editorFile");
        const ext = (ctx.filename || "txt").includes(".") ? ctx.filename.split(".").pop() : "txt";
        new EditorFile(`wit-ai-${Date.now()}.${ext}`, { text: code, render: true });
      } else if (action === "Copy to clipboard") {
        await this.copyText(code);
      }
    } catch (e) {
      this.safeToast("Apply failed: " + (e.message || e));
    }
  }

  async copyText(text) {
    const s = String(text ?? "");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(s);
        this.safeToast("Copied");
        return;
      }
    } catch { /* fall through */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = s;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      this.safeToast("Copied");
    } catch {
      acode.alert("WIT AI — Copy", s.slice(0, 3000));
    }
  }

  async quickAction(type) {
    if (this.actionBusy || this.isStreaming) {
      this.safeToast("Already working…");
      return;
    }
    const ctx = this.getCurrentContext();
    const system = `You are WIT AI inside Acode. Return production-ready code. Match existing style. Prefer a single complete code block.`;
    let userContent = "";
    if (type === "fix" || type === "fixfile") {
      const code = type === "fixfile"
        ? (ctx.fullText || "")
        : (ctx.selection || ctx.fullText || "");
      if (!code || !String(code).trim()) {
        this.safeToast(type === "fixfile" ? "Open a file to fix" : "Open a file (or select code) to fix");
        return;
      }
      const scope = type === "fixfile" || !ctx.hasSelection ? "entire file" : "selected code";
      userContent = `Fix bugs, syntax errors, and obvious issues in the ${scope}. Keep behavior unless broken.

File: ${ctx.filename} (${ctx.language})

\`\`\`${ctx.language}
${code}
\`\`\`

Return ONLY the fixed code in one fenced block (no long essay).`;
    } else {
      const feature = await acode.prompt("What do you want to generate / add?", "");
      if (!feature) return;
      userContent = `Generate/implement: ${feature}

Current file (${ctx.filename}):
\`\`\`${ctx.language}
${(ctx.fullText || "").slice(0, 12000)}
\`\`\`

Return ready-to-apply code in one fenced block.`;
    }
    const messages = [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ];
    this.actionBusy = true;
    try {
      const loadMsgs = ["Analyzing…", "Crafting fix…", "Reviewing code…", "Working…"];
      acode.loader?.show?.(loadMsgs[Math.floor(Math.random() * loadMsgs.length)]);
      const result = await this.callLLM(messages);
      acode.loader?.hide?.();
      if (result) await this.applyResult(result, ctx);
      else this.safeToast("Empty response — try another model");
    } catch (e) {
      acode.loader?.hide?.();
      // Single alert only (no multi-tap spam)
      acode.alert("WIT AI", (e.message || String(e)).slice(0, 800));
    } finally {
      this.actionBusy = false;
    }
  }

  async attachExtraFiles() {
    const choice = await acode.select("Attach files", [
      "From project tree",
      "Browse storage / SAF",
      "Clear attachments",
      "Cancel",
    ]);
    if (!choice || choice === "Cancel") return;
    if (choice === "Clear attachments") {
      this.attachedFiles = [];
      this.safeToast("Attachments cleared");
      return;
    }
    try {
      const fileBrowser = acode.require("fileBrowser");
      const mode = choice === "From project tree" ? "file" : "file";
      const picked = await fileBrowser(mode, "Select file to attach");
      if (!picked || !picked.url) return;
      const fs = acode.require("fs");
      const name = picked.name || picked.url.split("/").pop() || "file";
      // skip if same as already-open active file
      const ctx = this.getCurrentContext();
      if (ctx.uri && picked.url === ctx.uri) {
        this.safeToast("Open file is already in context — pick another");
        return;
      }
      let content = "";
      try {
        content = await (await fs(picked.url)).readFile("utf-8");
      } catch (e) {
        this.safeToast("Cannot read file (binary or blocked)");
        return;
      }
      if (content.length > 120000) content = content.slice(0, 120000) + "\n/* truncated */";
      // dedupe by path
      this.attachedFiles = this.attachedFiles.filter((f) => f.path !== picked.url);
      this.attachedFiles.push({ name, path: picked.url, content });
      if (this.attachedFiles.length > 6) this.attachedFiles = this.attachedFiles.slice(-6);
      this.safeToast("Attached " + name + " (" + this.attachedFiles.length + " total)");
    } catch (e) {
      this.safeToast("Attach failed: " + (e.message || e));
    }
  }

  formatAttachmentsBlock() {
    if (!this.attachedFiles?.length) return "";
    let out = "\n\nAttached files (extra context):\n";
    for (const f of this.attachedFiles) {
      out += `\n--- ${f.name} ---\n\`\`\`\n${f.content.slice(0, 20000)}\n\`\`\`\n`;
    }
    return out;
  }



  async executeAgentActions(actions, folderUrl) {
    const fs = acode.require("fs");
    const results = [];
    folderUrl = folderUrl || this.getWorkspaceFolder();
    for (const act of actions) {
      if (!act || !act.action) continue;
      if (act.action === "done") {
        results.push("✓ " + (act.summary || "done"));
        continue;
      }
      if (act.action === "read") {
        try {
          const url = this.resolveProjectPath(folderUrl, act.path);
          const content = await (await fs(url)).readFile("utf-8");
          results.push("Read " + act.path + " (" + content.length + " chars)");
        } catch (e) {
          results.push("Failed read " + act.path + ": " + e.message);
        }
        continue;
      }
      if (act.action === "write" || act.action === "create") {
        const newContent = act.content || "";
        // Guard: refuse silent shrink of existing files (common model failure)
        if (act.action === "write") {
          try {
            const fs = acode.require("fs");
            const url = this.resolveProjectPath(folderUrl, act.path);
            const prev = await (await fs(url)).readFile("utf-8");
            if (prev && prev.length > 80 && newContent.length < prev.length * 0.55) {
              const force = await acode.confirm(
                "BLOCKED unsafe write to " + act.path +
                "\n\nNew content is much shorter (" + newContent.length + " vs " + prev.length +
                " chars) and would likely remove features.\n\nForce write anyway? (Prefer Cancel and ask Agent to PATCH only.)"
              );
              if (!force) {
                results.push("Blocked short write " + act.path + " (use patch)");
                continue;
              }
            }
          } catch { /* new file or unreadable — ok */ }
        }
        // Auto-apply writes (user asked agent to do the work) — one confirm
        const ok = await acode.confirm(
          (act.action === "create" ? "Create file" : "Write full file") + ":\n" + act.path +
          "\n\n" + newContent.length + " characters. Continue?"
        );
        if (!ok) { results.push("Skipped " + act.action + " " + act.path); continue; }
        try {
          await this.writeProjectFile(act.path, newContent, folderUrl);
          results.push("✓ " + act.action + " " + act.path + " (" + newContent.length + " chars)");
        } catch (e) {
          results.push("Failed " + act.action + " " + act.path + ": " + e.message);
        }
        continue;
      }
      if (act.action === "patch") {
        const ok = await acode.confirm("Apply patch to:\n" + act.path + "\n\n(Only the matched section changes.)");
        if (!ok) { results.push("Skipped patch " + act.path); continue; }
        try {
          const url = this.resolveProjectPath(folderUrl, act.path);
          const file = await fs(url);
          let content = await file.readFile("utf-8");
          if (!act.find || !content.includes(act.find)) {
            results.push("Patch miss " + act.path + ": find text not found");
          } else {
            content = content.replace(act.find, act.replace ?? "");
            await file.writeFile(content);
            results.push("✓ patch " + act.path);
          }
        } catch (e) {
          results.push("Failed patch " + act.path + ": " + e.message);
        }
        continue;
      }

      if (act.action === "run") {
        const cmd = act.command || act.cmd || "";
        const note = act.note || "Run in Acode terminal or Termux (cd into the project first).";
        if (!cmd) { results.push("Empty run command skipped"); continue; }
        results.push("▶ command: " + cmd);
        try {
          const copy = await acode.confirm(
            "Shell command (you run this):\n\n" + cmd + "\n\n" + note + "\n\nCopy to clipboard?"
          );
          if (copy) await this.copyText(cmd);
          else await this.copyText(cmd); // still copy for convenience
          this.safeToast("Command copied — paste in terminal");
        } catch {
          await this.copyText(cmd);
        }
        continue;
      }
      if (act.action === "delete") {
        const ok = await acode.confirm("DELETE file:\n" + act.path + "\\n\\nProceed?");
        if (!ok) { results.push("Skipped delete " + act.path); continue; }
        try {
          const url = this.resolveProjectPath(folderUrl, act.path);
          const file = await fs(url);
          if (typeof file.delete === "function") await file.delete();
          else if (typeof file.remove === "function") await file.remove();
          else throw new Error("delete not available on this file system");
          results.push("✓ deleted " + act.path);
        } catch (e) {
          results.push("Failed delete " + act.path + ": " + e.message);
        }
        continue;
      }
    }
    if (results.length) {
      this.safeToast(results.filter((r) => r.startsWith("✓")).length + " ok");
      acode.alert("WIT AI Agent", results.join("\n") || "No actions");
    }
    return results;
  }

  /** Parse model output into action list (JSON array or <tool_call> XML style). */
  parseAgentActions(raw) {
    const text = String(raw || "").trim();
    if (!text) return [];

    // 1) Prefer JSON array
    const tryJson = (s) => {
      try {
        const cleaned = s
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        // extract first [...] if prose wraps it
        const a = cleaned.indexOf("[");
        const b = cleaned.lastIndexOf("]");
        const slice = a >= 0 && b > a ? cleaned.slice(a, b + 1) : cleaned;
        const parsed = JSON.parse(slice);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && parsed.action) return [parsed];
      } catch { /* */ }
      return null;
    };
    const asJson = tryJson(text);
    if (asJson) return asJson;

    // 2) <tool_call> / <function=name> ... style (common on gpt-oss / some instruct models)
    const actions = [];
    const blocks = text.split(/<tool_call>/i).slice(1);
    for (const block of blocks) {
      const body = block.split(/<\/tool_call>/i)[0] || block;
      let fn = "";
      const fnTag = body.match(/<function[=:]?\s*([a-zA-Z0-9_.-]+)\s*>/i)
        || body.match(/<function>\s*([a-zA-Z0-9_.-]+)\s*<\/function>/i);
      if (fnTag) fn = fnTag[1];
      const params = {};
      const re = /<parameter[=:]?\s*([a-zA-Z0-9_.-]+)\s*>([\s\S]*?)<\/parameter>/gi;
      let m;
      while ((m = re.exec(body))) {
        params[m[1]] = m[2].trim();
      }
      // also <path>...</path> shorthand
      const pathM = body.match(/<path>\s*([\s\S]*?)\s*<\/path>/i);
      if (pathM && !params.path) params.path = pathM[1].trim();
      const name = (fn || "").toLowerCase().replace(/([A-Z])/g, "_$1").toLowerCase();
      if (name.includes("read") || name === "read_file" || name === "readfile") {
        actions.push({
          action: "read",
          path: params.path || params.file || params.filename || "",
        });
      } else if (name.includes("write") || name === "write_file" || name === "writefile") {
        actions.push({
          action: "write",
          path: params.path || params.file || "",
          content: params.content || params.text || params.code || "",
        });
      } else if (name.includes("create") || name === "create_file") {
        actions.push({
          action: "create",
          path: params.path || params.file || "",
          content: params.content || params.text || "",
        });
      } else if (name.includes("patch") || name.includes("edit") || name === "str_replace") {
        actions.push({
          action: "patch",
          path: params.path || params.file || "",
          find: params.find || params.old || params.old_str || params.search || "",
          replace: params.replace || params.new || params.new_str || params.content || "",
        });
      } else if (name.includes("delete") || name === "remove_file" || name === "unlink") {
        actions.push({
          action: "delete",
          path: params.path || params.file || "",
        });
      } else if (name.includes("list") || name === "list_dir" || name === "list_directory") {
        actions.push({ action: "read", path: params.path || "." });
      } else if (fn) {
        // unknown — ignore
      }
    }
    if (actions.length) return actions;

    // 3) lines like: READ path / WRITE path
    const lineActs = [];
    for (const line of text.split("\n")) {
      const rm = line.match(/^\s*(READ|WRITE|CREATE|PATCH|DELETE)\s+(\S+)/i);
      if (rm) lineActs.push({ action: rm[1].toLowerCase(), path: rm[2] });
    }
    return lineActs;
  }

  resolveProjectPath(folderUrl, relPath) {
    const p = String(relPath || "").trim().replace(/^\/+/, "");
    if (!p) return folderUrl || "";
    if (/^(file|content|ftp|sftp|https?):/i.test(p)) return p;
    if (!folderUrl) return p;
    return folderUrl.replace(/\/$/, "") + "/" + p;
  }

  async runAgent(presetTask) {
    let task = typeof presetTask === "string" ? presetTask.trim() : "";
    if (!task) {
      task = await acode.prompt(
        "Agent task (or type in chat and tap Agent)",
        ""
      );
    }
    if (!task) return;
    if (this.actionBusy) {
      this.safeToast("Already working…");
      return;
    }

    const ctx = this.getCurrentContext();
    let folderUrl = this.getWorkspaceFolder();
    const proj = await this.getProjectTreeSummary(100);
    if (proj.folderUrl) folderUrl = proj.folderUrl;
    const fileTreeSummary = proj.summary;

    const system = `You are WIT AI Agent inside the Acode Android editor.
Respond with ONLY a JSON array (no markdown, no prose, no XML tool_call tags):
[
  {"action":"read","path":"relative/or/path"},
  {"action":"patch","path":"path","find":"exact old substring from the file","replace":"new substring"},
  {"action":"write","path":"path","content":"COMPLETE full file — every previous feature kept unless user asked to remove it"},
  {"action":"create","path":"path","content":"full new file contents"},
  {"action":"delete","path":"path"},
  {"action":"run","command":"shell command","note":"user runs in terminal"},
  {"action":"done","summary":"short summary"}
]
HARD RULES:
1. SMALL changes (CSS, one function, layout, header) → use "patch" only. Never rewrite the whole file.
2. Before any "write" on an existing file, you MUST "read" it in a prior action/round and then write the FULL merged file (old features + new work). Omitting existing code is a failure.
3. Never tell the user to paste, restore, or re-add code blocks. You apply changes via actions.
4. Prefer multiple patches over one write. Always end with "done". Paths relative to project folder.`;

    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content: `Task: ${task}

Current file: ${ctx.filename}
Project tree (partial):
${fileTreeSummary}

Current file content (truncated):
\`\`\`${ctx.language}
${(ctx.selection || ctx.fullText).slice(0, 6000)}
\`\`\`
${this.formatAttachmentsBlock()}
${this.webForceOn ? "(Web lookup is ON for this session.)" : ""}`,
      },
    ];

    this.actionBusy = true;
    try {
      // Up to 3 plan→execute rounds (read then write)
      let allResults = [];
      for (let round = 0; round < 3; round++) {
        const agentPhases = ["Mapping the task…", "Reading sources…", "Planning edits…", "Applying changes…"];
        acode.loader?.show?.(agentPhases[Math.min(round, agentPhases.length - 1)] + " (" + (round + 1) + ")");
        const raw = await this.callLLM(messages, { max_tokens: 8192 });
        acode.loader?.hide?.();
        if (!raw) break;

        let actions = this.parseAgentActions(raw);
        if (!actions.length) {
          if (round === 0) {
            acode.alert(
              "WIT AI Agent",
              "Model did not return usable actions.\\n\\n" + String(raw).slice(0, 900)
            );
          }
          break;
        }

        // Feed read results back for next round
        const reads = actions.filter((a) => a.action === "read");
        const others = actions.filter((a) => a.action !== "read");

        if (reads.length) {
          const fs = acode.require("fs");
          for (const act of reads) {
            try {
              const url = this.resolveProjectPath(folderUrl, act.path);
              const content = await (await fs(url)).readFile("utf-8");
              allResults.push("Read " + act.path + " (" + content.length + " chars)");
              messages.push({
                role: "user",
                content: `File ${act.path}:\n\`\`\`\n${content.slice(0, 10000)}\n\`\`\`\nContinue the task with write/patch/delete JSON actions only.`,
              });
            } catch (e) {
              allResults.push("Failed read " + act.path + ": " + e.message);
              messages.push({
                role: "user",
                content: `Could not read ${act.path}: ${e.message}. Adjust plan.`,
              });
            }
          }
        }

        if (others.length) {
          const part = await this.executeAgentActions(others, folderUrl);
          allResults = allResults.concat(part || []);
        }

        const done = actions.some((a) => a.action === "done");
        if (done || (others.length && !reads.length)) break;
        if (!reads.length && !others.length) break;
      }
      acode.alert("WIT AI Agent", allResults.join("\n") || "No actions executed.");
    } catch (e) {
      acode.loader?.hide?.();
      acode.alert("WIT AI Agent Error", e.message || String(e));
    } finally {
      this.actionBusy = false;
      acode.loader?.hide?.();
    }
  }

  async newProject() {
    if (this.actionBusy) { this.safeToast("Already working…"); return; }
    const description = await acode.prompt(
      "Describe the project (stack + features)",
      "Simple HTML/CSS/JS todo app"
    );
    if (!description) return;
    let folder;
    try {
      folder = await acode.require("fileBrowser")("folder", "Choose parent folder for the new project");
    } catch {
      this.safeToast("Cancelled");
      return;
    }
    if (!folder?.url) return;

    const messages = [
      {
        role: "system",
        content: `You are a project scaffolder. Output ONLY valid JSON (no markdown):
{
  "name": "project-folder-name",
  "files": [
    {"path": "index.html", "content": "..."},
    {"path": "src/main.js", "content": "..."}
  ],
  "commands": ["npm install", "npm start"]
}
Include README.md with run instructions. Keep files reasonably sized. commands = what the user runs in terminal after scaffold.`,
      },
      { role: "user", content: description },
    ];

    try {
      acode.loader?.show?.("Scaffolding project…");
      const raw = await this.callLLM(messages, { max_tokens: 8192 });
      acode.loader?.hide?.();
      if (!raw) return;
      let json;
      try {
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        json = JSON.parse(cleaned);
      } catch {
        acode.alert("WIT AI", "Could not parse project JSON.\n\n" + raw.slice(0, 800));
        return;
      }
      if (!json.name || !Array.isArray(json.files)) {
        acode.alert("WIT AI", "Invalid project structure returned.");
        return;
      }
      const fs = acode.require("fs");
      const root = await fs(folder.url);
      const projectUrl = await root.createDirectory(json.name);
      for (const f of json.files) {
        if (!f.path || typeof f.content !== "string") continue;
        const parts = f.path.replace(/\\/g, "/").split("/").filter(Boolean);
        let currentUrl = projectUrl;
        for (let i = 0; i < parts.length - 1; i++) {
          try {
            currentUrl = await (await fs(currentUrl)).createDirectory(parts[i]);
          } catch {
            currentUrl = `${currentUrl.replace(/\/$/, "")}/${parts[i]}`;
          }
        }
        await (await fs(currentUrl)).createFile(parts[parts.length - 1], f.content);
      }
      acode.loader?.hide?.();
      this.safeToast('Created "' + json.name + '"');
      // Open project folder / entry file in Acode
      try {
        const openFolder = acode.require("openFolder");
        if (typeof openFolder === "function") {
          await openFolder(projectUrl, { name: json.name });
        } else if (openFolder && typeof openFolder.add === "function") {
          openFolder.add(projectUrl);
        }
      } catch (e) {
        console.warn("openFolder", e);
      }
      try {
        const entry = (json.files || []).find((f) => /^(index\.html|main\.(js|ts|py)|App\.(js|tsx)|README\.md)$/i.test(f.path))
          || (json.files || [])[0];
        if (entry?.path) {
          const parts = entry.path.replace(/\\/g, "/").split("/").filter(Boolean);
          let fileUrl = projectUrl;
          for (const part of parts) fileUrl = fileUrl.replace(/\/$/, "") + "/" + part;
          const EditorFile = acode.require("editorFile");
          new EditorFile(entry.path.split("/").pop(), { uri: fileUrl, text: entry.content, render: true });
        }
      } catch (e) {
        console.warn("open entry file", e);
      }
      const cmds = Array.isArray(json.commands) ? json.commands.filter(Boolean) : [];
      if (cmds.length) {
        const block = cmds.join("\n");
        const copy = await acode.confirm(
          `Project "${json.name}" created.\n\nRun in terminal (project folder):\n\n${block}\n\nCopy commands?`
        );
        if (copy !== false) await this.copyText(block);
      } else {
        acode.alert("WIT AI", `Project "${json.name}" created and opened.`);
      }
    } catch (e) {
      acode.loader?.hide?.();
      acode.alert("WIT AI Error", e.message || String(e));
    } finally {
      this.actionBusy = false;
    }
  }

  /** Build chat UI into a container (page body or sidebar). Returns root element. */
  async mountChatUI(host) {
    const provider = await this.getSetting("provider", "groq");
    host.innerHTML = "";

    if (!document.getElementById("wit-ai-styles")) {
      const style = document.createElement("style");
      style.id = "wit-ai-styles";
      style.textContent = `
        .wit-root { display:flex; flex-direction:column; height:100%; min-height:280px; background:var(--secondary-color,#1e1e1e); color:var(--primary-text-color,#eee); font-family:system-ui,sans-serif; }
        .wit-header { padding:10px 12px; border-bottom:1px solid #333; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .wit-header select, .wit-header button {
          background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:6px;
          padding:8px 10px; font-size:13px; min-height:36px;
        }
        .wit-header select {
          min-width: 120px;
          max-width: 48%;
          flex: 1 1 120px;
          -webkit-appearance: menulist;
          appearance: menulist;
        }
        .wit-header #wit-model { min-width: 150px; flex: 1 1 150px; }
        .wit-header button { cursor:pointer; flex: 0 0 auto; min-width: 40px; }
        .wit-header button:active { background:#3d3d3d; }
        .wit-messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; max-height:50vh; }
        .wit-msg { max-width:92%; padding:10px 12px; border-radius:10px; line-height:1.45; font-size:14px; white-space:pre-wrap; word-break:break-word; color:#f5f5f5; -webkit-user-select:text; user-select:text; }
        .wit-msg.user { align-self:flex-end; background:#0d6efd !important; color:#ffffff !important; }
        .wit-msg.assistant { align-self:flex-start; background:#2a2d3a !important; color:#f5f5f5 !important; border:1px solid #5a6278 !important; box-shadow:0 2px 8px rgba(0,0,0,.2); }
        .wit-msg.assistant.error { background:#5a2020 !important; color:#ffe0e0 !important; border:1px solid #aa5555 !important; }
        .wit-msg.system { align-self:center; background:transparent !important; color:#cccccc !important; font-size:12px; }
        .wit-msg pre, .wit-msg code, .wit-code, .wit-inline { background:#1a1a1a !important; color:#f0f0f0 !important; padding:8px; border-radius:6px; overflow-x:auto; margin:6px 0; font-family:monospace; font-size:13px; }
        .wit-inline { padding:2px 5px; margin:0 2px; display:inline; }
        .wit-link { color:#6cb6ff !important; text-decoration:underline !important; word-break:break-all; }
        .wit-msg.user .wit-link { color:#d0e8ff !important; }
        .wit-msg strong { font-weight:700; color:#ffffff; }
        .wit-msg em { font-style:italic; }
        .wit-messages { background:#1a1a1a !important; color:#f5f5f5 !important; }
        .wit-input-row { display:flex; gap:8px; padding:10px; border-top:1px solid #333; }
        .wit-input-row textarea { flex:1; min-height:44px; max-height:120px; resize:vertical; background:#2d2d2d; color:#eee; border:1px solid #444; border-radius:8px; padding:10px; font-size:14px; }
        .wit-input-row button { background:#0d6efd; color:#fff; border:none; border-radius:8px; padding:0 16px; font-weight:600; cursor:pointer; }
        .wit-input-row button.stop { background:#dc3545; }
        .wit-input-row button:disabled { opacity:0.5; }
        .wit-quick { display:flex; gap:6px; padding:0 10px 8px; flex-wrap:wrap; }
        .wit-quick button { background:#333; color:#ccc; border:1px solid #444; border-radius:16px; padding:4px 10px; font-size:12px; cursor:pointer; }
      `;
      document.head.appendChild(style);
    }

    const root = document.createElement("div");
    root.className = "wit-root";
    root.setAttribute("data-wit-version", "1.4.15");

    const header = document.createElement("div");
    header.className = "wit-header";
    header.innerHTML = `
      <span class="wit-ver" style="font-weight:700;font-size:12px;color:#a29bfe;margin-right:4px;">WIT&nbsp;AI&nbsp;1.4.15</span>
      <select id="wit-provider" title="Provider">
        <option value="groq">Groq</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="gemini">Gemini</option>
        <option value="huggingface">Hugging Face</option>
        <option value="openai_compatible">Custom / inference</option>
      </select>
      <select id="wit-model" title="Model"><option value="">Loading…</option></select>
      <button type="button" id="wit-settings-btn" title="Settings">⚙</button>
      <button type="button" id="wit-clear-btn" title="Clear chat">🗑</button>
`;
    root.appendChild(header);

    const messagesEl = document.createElement("div");
    messagesEl.className = "wit-messages scroll";
    messagesEl.style.overflowY = "auto";
    root.appendChild(messagesEl);

    const quick = document.createElement("div");
    quick.className = "wit-quick";
    quick.innerHTML = `
      <button type="button" data-q="agent">Agent</button>
      <button type="button" data-q="fix">Fix</button>
      <button type="button" data-q="fixfile">Fix file</button>
      <button type="button" data-q="generate">Generate</button>
      <button type="button" data-q="web">Web</button>
      <button type="button" data-q="attach">Attach</button>
      <button type="button" data-q="context">Project</button>
      <button type="button" data-q="newchat">New chat</button>
      <button type="button" data-q="sessions">Sessions</button>
      <button type="button" data-q="project">Scaffold</button>
      <button type="button" data-q="mcp">MCP</button>
`;
    root.appendChild(quick);

    const inputRow = document.createElement("div");
    inputRow.className = "wit-input-row";
    inputRow.innerHTML = `
      <textarea id="wit-input" placeholder="Ask WIT AI… (current file is context)" rows="2"></textarea>
      <button type="button" id="wit-send">Send</button>
    `;
    root.appendChild(inputRow);

    host.appendChild(root);
    await this.bindChatUI(root, header, messagesEl, quick, inputRow, provider);
    return root;
  }

  async bindChatUI(root, header, messagesEl, quick, inputRow, provider) {
    const providerSel = header.querySelector("#wit-provider");
    const modelSel = header.querySelector("#wit-model");
    if (!providerSel.options || providerSel.options.length === 0) {
      [
        ["groq", "Groq"],
        ["openai", "OpenAI"],
        ["anthropic", "Anthropic"],
        ["gemini", "Gemini"],
        ["huggingface", "Hugging Face"],
        ["openai_compatible", "Custom / inference"],
      ].forEach(([id, label]) => {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = label;
        providerSel.appendChild(o);
      });
    }
    try { providerSel.value = provider || "groq"; } catch { providerSel.selectedIndex = 0; }

    const fillModels = async () => {
      const p = providerSel.value;
      modelSel.innerHTML = "";
      const saved = await this.getSetting("model", "");
      let list = [];
      let source = "fallback";
      // Prefer models available to THIS key only
      try {
        const remote = await this.fetchRemoteModels();
        if (remote.length) {
          list = remote;
          source = "live";
        }
      } catch { /* fallback */ }
      if (!list.length) {
        list = (this.MODELS[p] || []).slice();
        source = "fallback";
      }
      // Always allow typing a custom id
      if (!list.some((m) => m.id === "custom")) {
        list = list.concat([{ id: "custom", label: "Custom model ID…" }]);
      }
      for (const m of list) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label + (source === "live" && m.id !== "custom" ? "" : "");
        if (m.id === saved) opt.selected = true;
        modelSel.appendChild(opt);
      }
      if (saved && ![...modelSel.options].some((o) => o.value === saved)) {
        const opt = document.createElement("option");
        opt.value = saved;
        opt.textContent = saved + " (saved)";
        opt.selected = true;
        modelSel.appendChild(opt);
      }
      if (list.length && !modelSel.value) modelSel.value = list[0].id;
      // Hint in system area when using offline list
      if (source === "fallback") {
        // non-blocking: user may not have key yet
      }
    };
    await fillModels();

    providerSel.onchange = async () => {
      await this.setSetting("provider", providerSel.value);
      await fillModels();
      await this.setSetting("model", modelSel.value);
    };
    modelSel.onchange = async () => {
      if (modelSel.value === "custom") {
        const prevModel = await this.getSetting("model", "");
        const custom = await this.withNativeDialog(() => acode.prompt("Custom model ID", prevModel));
        if (custom) {
          await this.setSetting("model", custom.trim());
          const opt = document.createElement("option");
          opt.value = custom.trim();
          opt.textContent = custom.trim();
          opt.selected = true;
          modelSel.appendChild(opt);
        }
      } else {
        await this.setSetting("model", modelSel.value);
      }
    };

    header.querySelector("#wit-settings-btn").onclick = () => this.withNativeDialog(() => this.openSettings());
    header.querySelector("#wit-clear-btn").onclick = async () => {
      const pick = await this.withNativeDialog(() =>
        acode.select("Delete chat history", [
          "Clear this chat",
          "Delete this session",
          "Cancel",
        ])
      );
      if (!pick || pick === "Cancel") return;
      if (pick === "Clear this chat") {
        const ok = await this.withNativeDialog(() =>
          acode.confirm("Clear all messages in this chat?")
        );
        if (!ok) return;
        await this.clearCurrentChatHistory();
        messagesEl.innerHTML = "";
        addSystem("Chat history cleared");
        this.safeToast("Chat cleared");
        return;
      }
      if (pick === "Delete this session") {
        const sid = this.currentSessionId;
        const name = this.sessions.find((s) => s.id === sid)?.name || "session";
        const ok = await this.withNativeDialog(() =>
          acode.confirm("Delete session \"" + name + "\" and its history?")
        );
        if (!ok) return;
        await this.deleteSessionById(sid);
        messagesEl.innerHTML = "";
        if (this.history.length) {
          for (let i = 0; i < this.history.length; i++) {
            const m = this.history[i];
            addMsg(m.role === "user" ? "user" : "assistant", m.content, i);
          }
        }
        addSystem("Session deleted. Now: " + (this.sessions.find((s) => s.id === this.currentSessionId)?.name || "Main"));
        this.safeToast("Session deleted");
      }
    };

    const escapeHtml = (s) => String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    /** Lightweight markdown → HTML for chat bubbles (safe: escape first, then allow limited tags). */
    const formatMarkdown = (raw) => {
      if (raw == null) return "";
      let s = String(raw);
      // Extract fenced code blocks first
      const blocks = [];
      s = s.replace(/```[\w+-]*\n?([\s\S]*?)```/g, (_, code) => {
        const i = blocks.length;
        blocks.push(`<pre class="wit-code">${escapeHtml(code.replace(/\n$/, ""))}</pre>`);
        return `\u0000BLOCK${i}\u0000`;
      });
      // Inline code
      const inlines = [];
      s = s.replace(/`([^`\n]+)`/g, (_, code) => {
        const i = inlines.length;
        inlines.push(`<code class="wit-inline">${escapeHtml(code)}</code>`);
        return `\u0000INLINE${i}\u0000`;
      });
      s = escapeHtml(s);
      // Bold **text** or __text__
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      // Italic *text* or _text_ (simple, avoid mid-word)
      s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,]|$)/g, "$1<em>$2</em>");
      s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,]|$)/g, "$1<em>$2</em>");
      // Markdown links [label](url)
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a class="wit-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      // Bare URLs (not already inside an href)
      s = s.replace(/(^|[^"'>])(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g,
        '$1<a class="wit-link" href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
      // Simple lists: lines starting with * or - or numbered
      s = s.replace(/(^|\n)(?:\*|-)\s+(.+)/g, "$1• $2");
      s = s.replace(/(^|\n)(\d+)\.\s+(.+)/g, "$1$2. $3");
      // Line breaks
      s = s.replace(/\n/g, "<br>");
      // Restore code
      s = s.replace(/\u0000INLINE(\d+)\u0000/g, (_, i) => inlines[+i] || "");
      s = s.replace(/\u0000BLOCK(\d+)\u0000/g, (_, i) => blocks[+i] || "");
      return s;
    };

    const rebuildMessages = () => {
      messagesEl.innerHTML = "";
      for (let i = 0; i < this.history.length; i++) {
        const m = this.history[i];
        addMsg(m.role === "user" ? "user" : "assistant", m.content, i);
      }
    };

    const addMsg = (role, text, histIndex) => {
      const div = document.createElement("div");
      div.className = `wit-msg ${role}`;
      if (typeof histIndex === "number") div.dataset.histIndex = String(histIndex);
      if (role === "user") {
        div.style.cssText = "align-self:flex-end;background:#0d6efd;color:#fff;max-width:92%;padding:10px 12px;border-radius:10px;line-height:1.45;font-size:14px;word-break:break-word;";
      } else if (role === "assistant") {
        div.style.cssText = "align-self:flex-start;background:#333;color:#f5f5f5;border:1px solid #666;max-width:92%;padding:10px 12px;border-radius:10px;line-height:1.45;font-size:14px;word-break:break-word;";
      } else {
        div.style.cssText = "align-self:center;color:#ccc;font-size:12px;padding:4px 8px;word-break:break-word;";
      }
      div.innerHTML = formatMarkdown(text);
      // Copy icon + long-press menu (Copy / Delete)
      try {
        if (role === "user" || role === "assistant") {
          const copy = document.createElement("button");
          copy.type = "button";
          copy.title = "Copy";
          copy.setAttribute("aria-label", "Copy");
          copy.innerHTML = "⧉";
          copy.style.cssText = "display:inline-flex;align-items:center;justify-content:center;margin-top:6px;margin-left:6px;width:28px;height:28px;background:#3a3a3a;color:#eee;border:1px solid #555;border-radius:6px;padding:0;font-size:14px;line-height:1;";
          copy.onclick = (ev) => { ev.stopPropagation(); this.copyText(text); };
          div.appendChild(copy);

          const openMsgMenu = async () => {
            try { if (navigator.vibrate) navigator.vibrate(15); } catch { /* */ }
            let idx = typeof histIndex === "number" ? histIndex : null;
            if (idx == null && div._histIndex != null) idx = div._histIndex;
            if (idx == null && div.dataset.histIndex != null) idx = parseInt(div.dataset.histIndex, 10);
            if (idx == null || Number.isNaN(idx)) {
              idx = this.history.findIndex((m) => m.role === role && m.content === text);
            }
            const opts = ["Copy"];
            if (idx >= 0) opts.push("Delete message");
            opts.push("Cancel");
            const pick = await this.withNativeDialog(() => acode.select("Message", opts));
            if (!pick || pick === "Cancel") return;
            if (pick === "Copy") {
              await this.copyText(text);
              return;
            }
            if (pick === "Delete message") {
              const ok = await this.withNativeDialog(() =>
                acode.confirm("Delete this message from chat history?")
              );
              if (!ok) return;
              if (await this.deleteHistoryMessage(idx)) {
                rebuildMessages();
                this.safeToast("Message deleted");
              }
            }
          };

          let pressTimer = null;
          const startPress = (ev) => {
            if (ev.target && (ev.target.closest && ev.target.closest("button, a"))) return;
            pressTimer = setTimeout(() => { pressTimer = null; openMsgMenu(); }, 480);
          };
          const clearPress = () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; };
          div.addEventListener("touchstart", startPress, { passive: true });
          div.addEventListener("touchend", clearPress);
          div.addEventListener("touchmove", clearPress);
          div.addEventListener("mousedown", startPress);
          div.addEventListener("mouseup", clearPress);
          div.addEventListener("mouseleave", clearPress);
        }
      } catch { /* ignore */ }
      // Make links open via Acode browser if available
      div.querySelectorAll("a.wit-link").forEach((a) => {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          const href = a.getAttribute("href");
          try {
            if (typeof acode !== "undefined" && typeof acode.openLink === "function") {
              acode.openLink(href);
            } else if (typeof system !== "undefined" && system.openInBrowser) {
              system.openInBrowser(href);
            } else {
              window.open(href, "_blank");
            }
          } catch {
            window.open(href, "_blank");
          }
        });
      });
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    };
    const addSystem = (t) => addMsg("system", t);

    if (this.history.length) {
      for (let i = 0; i < this.history.length; i++) {
        const m = this.history[i];
        addMsg(m.role === "user" ? "user" : "assistant", m.content, i);
      }
    } else {
      addSystem("WIT AI 1.4.15 ready. Long-press a message to copy/delete. 🗑 clears chat or deletes the session.");
    }

    quick.querySelectorAll("button").forEach((btn) => {
      btn.onclick = async () => {
        const q = btn.dataset.q;
        if (q === "fix") return this.quickAction("fix"); // selection preferred
        if (q === "generate") return this.quickAction("generate");
        if (q === "agent") {
          const pending = (inputRow.querySelector("#wit-input")?.value || "").trim();
          if (pending) {
            inputRow.querySelector("#wit-input").value = "";
            return this.runAgent(pending);
          }
          return this.runAgent();
        }
        if (q === "project") return this.newProject();
        if (q === "fixfile") {
          if (this.actionBusy || this.isStreaming) return this.safeToast("Already working…");
          const ctx = this.getCurrentContext();
          if (!ctx.fullText) return addSystem("No open file — open one in the editor");
          return this.quickAction("fixfile"); // always whole file
        }
        if (q === "web") {
          this.webForceOn = !this.webForceOn;
          btn.style.background = this.webForceOn ? "#6c5ce7" : "";
          btn.style.color = this.webForceOn ? "#fff" : "";
          btn.textContent = this.webForceOn ? "Web ON" : "Web";
          addSystem(this.webForceOn
            ? "Web lookup ON for this session — searches run with each message (and agent)."
            : "Web lookup auto (only when query looks like docs/news/URL).");
          return;
        }
        if (q === "attach") {
          await this.attachExtraFiles();
          if (this.attachedFiles.length) {
            addSystem("Attachments: " + this.attachedFiles.map((f) => f.name).join(", "));
          }
          return;
        }
        if (q === "context") {
          const ctx = this.getCurrentContext();
          const proj = await this.getProjectTreeSummary(40);
          addSystem(`Open file (auto): ${ctx.filename} (${ctx.fullText.length} chars)\nFolder: ${proj.folderUrl || "(none)"}\nTree:\n${proj.summary}\nExtra attachments: ${this.attachedFiles.map((f)=>f.name).join(", ") || "(none)"}`);
        }
        if (q === "newchat") {
          const name = await acode.prompt("New session name", "Chat " + (this.sessions.length + 1));
          await this.newSession(name || undefined);
          messagesEl.innerHTML = "";
          const proj = await this.getProjectTreeSummary(40);
          addSystem("New session. Project:\n" + (proj.summary || "(open a folder in Acode sidebar)"));
          return;
        }
        if (q === "sessions") {
          if (!this.sessions.length) return addSystem("No sessions");
          const labels = this.sessions.map((s) => s.name + " (" + (s.history?.length || 0) + " msgs)");
          const pick = await this.withNativeDialog(() => acode.select("Sessions", labels));
          if (pick == null) return;
          const idx = labels.indexOf(pick);
          if (idx < 0) return;
          const sess = this.sessions[idx];
          const action = await this.withNativeDialog(() =>
            acode.select(sess.name, ["Open", "Delete session", "Cancel"])
          );
          if (!action || action === "Cancel") return;
          if (action === "Delete session") {
            const ok = await this.withNativeDialog(() =>
              acode.confirm("Delete session \"" + sess.name + "\" and its history?")
            );
            if (!ok) return;
            await this.deleteSessionById(sess.id);
            rebuildMessages();
            if (!this.history.length) addSystem("Session deleted.");
            this.safeToast("Session deleted");
            return;
          }
          await this.switchSession(sess.id);
          rebuildMessages();
          const proj = await this.getProjectTreeSummary(30);
          addSystem("Session: " + (this.sessions.find((s) => s.id === this.currentSessionId)?.name || "") + "\nProject tree:\n" + proj.summary);
          return;
        }
        if (q === "mcp") return this.configureMcp();
      };
    });

    const input = inputRow.querySelector("#wit-input");
    const sendBtn = inputRow.querySelector("#wit-send");

    const wireLinks = (el) => {
      el.querySelectorAll("a.wit-link").forEach((a) => {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          const href = a.getAttribute("href");
          try {
            if (typeof acode !== "undefined" && typeof acode.openLink === "function") acode.openLink(href);
            else if (typeof system !== "undefined" && system.openInBrowser) system.openInBrowser(href);
            else window.open(href, "_blank");
          } catch { window.open(href, "_blank"); }
        });
      });
    };

    const addApplyBar = (assistantEl, full) => {
      const blocks = this.extractCodeBlocks(full);
      if (!blocks.length) {
        // still allow copy of whole reply
        const bar = document.createElement("div");
        bar.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;";
        const c = document.createElement("button");
        c.type = "button";
        c.title = "Copy reply";
        c.innerHTML = "⧉";
        c.style.cssText = "background:#3a3a3a;color:#fff;border:1px solid #555;border-radius:8px;width:34px;height:34px;padding:0;font-size:15px;";
        c.onclick = () => this.copyText(full);
        bar.appendChild(c);
        assistantEl.appendChild(bar);
        return;
      }
      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;";
      const tagged = blocks.filter((b) => b.path);
      if (tagged.length) {
        const all = document.createElement("button");
        all.type = "button";
        all.textContent = tagged.length > 1 ? ("Write all " + tagged.length + " files") : ("Write " + tagged[0].path);
        all.style.cssText = "background:#00b894;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;";
        all.onclick = () => this.applyAllTaggedBlocks(full);
        bar.appendChild(all);
      }
      blocks.slice(0, 5).forEach((block, idx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = block.path ? ("Apply → " + block.path) : (blocks.length > 1 ? ("Apply block " + (idx + 1)) : "Apply to open file");
        b.style.cssText = "background:#6c5ce7;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:12px;";
        b.onclick = () => this.applyBlockSmart(block, full);
        bar.appendChild(b);
      });
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.title = "Copy";
      copyBtn.setAttribute("aria-label", "Copy");
      copyBtn.innerHTML = "⧉";
      copyBtn.style.cssText = "background:#3a3a3a;color:#fff;border:1px solid #555;border-radius:8px;width:34px;height:34px;padding:0;font-size:15px;";
      copyBtn.onclick = () => this.copyText(blocks.length === 1 ? blocks[0].content : full);
      bar.appendChild(copyBtn);
      assistantEl.appendChild(bar);
    };

    const send = async () => {
      let text = input.value.trim();
      if (!text || this.isStreaming) return;
      input.value = "";

      // /agent <task> runs multi-step agent using the message (no extra modal)
      if (/^\/agent\b/i.test(text) || /^agent:\s*/i.test(text)) {
        const task = text.replace(/^\/agent\b/i, "").replace(/^agent:\s*/i, "").trim() || text;
        this.history.push({ role: "user", content: text });
        addMsg("user", text, this.history.length - 1);
        await this.saveSessions();
        return this.runAgent(task);
      }

      this.history.push({ role: "user", content: text });
      addMsg("user", text, this.history.length - 1);

      // Immediate reply indicator (before web lookup / network)
      const assistantEl = addMsg("assistant", this.pickStatus("start"));
      assistantEl.style.opacity = "0.9";
      assistantEl.style.fontStyle = "italic";
      sendBtn.textContent = "Stop";
      sendBtn.classList.add("stop");
      this.isStreaming = true;

      // Keep status lively while waiting on network
      let statusTick = 0;
      const statusTimer = setInterval(() => {
        if (!this.isStreaming) return;
        statusTick++;
        if (assistantEl.dataset.phase === "stream") {
          this.setStatus(assistantEl, "stream");
        } else if (statusTick % 2 === 0 && assistantEl.dataset.phase) {
          this.setStatus(assistantEl, assistantEl.dataset.phase);
        }
      }, 2200);

      try {
        this.setStatus(assistantEl, "project");
        assistantEl.dataset.phase = "project";
        const ctx = this.getCurrentContext();
        const codeCtx = (ctx.selection || ctx.fullText).slice(0, 12000);
        const proj = await this.getProjectTreeSummary(60);

        const apiMessages = [
          {
            role: "system",
            content: `You are WIT AI in Acode. Be concise and practical. Today (UTC): ${new Date().toISOString().slice(0,10)}.
ALWAYS respect the open file, project tree, and any FILE sections below — you CAN read those files. Never claim you lack filesystem access.
Open file: ${ctx.filename} (${ctx.language})${ctx.uri ? " @ " + ctx.uri : ""}.
For SMALL fixes: describe the exact change or a minimal snippet — never a truncated full file.
If you output a full file, it must include ALL existing features plus the new work (tag path like: js src/app.js). Truncating the file is unacceptable.
Prefer the user use Agent for multi-file/safe edits. Shell: exact commands for terminal/Termux.
Live web context is authoritative when present.`,
          },
          ...this.history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        ];
        this.setStatus(assistantEl, "files", proj.folderUrl ? "workspace" : "no folder");
        assistantEl.dataset.phase = "files";
        const projectFiles = await this.loadProjectFilesForMessage(text);
        const nFiles = (projectFiles.match(/### FILE:/g) || []).length;
        if (nFiles) {
          this.setStatus(assistantEl, "files", nFiles + " file(s) loaded");
          this.safeToast("Loaded " + nFiles + " project file(s) into context");
        } else if (projectFiles && projectFiles.includes("No project folder")) {
          this.safeToast("Open project folder in sidebar for multi-file context");
        } else {
          this.setStatus(assistantEl, "files", "tree only");
        }
        this.setStatus(assistantEl, "web");
        assistantEl.dataset.phase = "web";
        const web = await this.maybeWebContext(text);
        this.setStatus(assistantEl, "think");
        assistantEl.dataset.phase = "think";
        apiMessages[apiMessages.length - 1] = {
          role: "user",
          content: `Project folder: ${proj.folderUrl || "(none)"}
Project tree (partial):
${proj.summary}

Open file (${ctx.filename}):
\`\`\`${ctx.language}
${codeCtx}
\`\`\`${this.formatAttachmentsBlock()}${projectFiles}${web}

User request:
${text}

You CAN read project files when FILE sections appear above. Never say you cannot access the filesystem. When editing, tag fences with the real path (e.g. app.js) so Apply writes the correct file — not index.html unless that is the target.
Web force: ${this.webForceOn ? "ON" : "auto"}. Prefer actionable code. Use latest stable APIs.`,
        };

        this.setStatus(assistantEl, "generate");
        assistantEl.dataset.phase = "generate";
        let full = "";
        let firstToken = true;
        await this.callLLMStream(apiMessages, (_delta, soFar) => {
          full = soFar;
          if (firstToken) {
            firstToken = false;
            assistantEl.style.fontStyle = "normal";
            assistantEl.style.opacity = "1";
            assistantEl.dataset.phase = "stream";
          }
          assistantEl.textContent = soFar;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
        if (full) {
          // If model emitted tool_call XML instead of normal answer, run agent executor
          if (/<tool_call>/i.test(full) || /"action"\s*:\s*"(read|write|patch|delete)"/.test(full)) {
            assistantEl.innerHTML = formatMarkdown("_Agent-style actions detected — executing…_");
            const acts = this.parseAgentActions(full);
            if (acts.length) {
              await this.executeAgentActions(acts, await this.getWorkspaceFolder());
              const summary = "Executed " + acts.length + " action(s). Use Agent chip for multi-step tasks.";
              assistantEl.innerHTML = formatMarkdown(summary);
              this.history.push({ role: "assistant", content: summary });
            } else {
              assistantEl.innerHTML = formatMarkdown(full);
              this.history.push({ role: "assistant", content: full });
            }
            await this.saveSessions();
          } else {
            this.history.push({ role: "assistant", content: full });
            await this.saveSessions();
            assistantEl.dataset.histIndex = String(this.history.length - 1);
            // Re-bind delete via dataset for long-press: store index for menu
            assistantEl._histIndex = this.history.length - 1;
            assistantEl.style.opacity = "1";
            assistantEl.style.fontStyle = "normal";
            assistantEl.innerHTML = formatMarkdown(full);
            wireLinks(assistantEl);
            addApplyBar(assistantEl, full);
            // Auto-offer durable project writes (survives leaving chat)
            const tagged = this.extractCodeBlocks(full).filter((b) => b.path);
            if (tagged.length && this.getWorkspaceFolder()) {
              const go = await acode.confirm(
                "Write " + tagged.length + " file(s) into the project now?\n\n" +
                tagged.map((b) => "• " + b.path).join("\n") +
                "\n\nThis saves on disk (not only the Apply bar)."
              );
              if (go) await this.applyAllTaggedBlocks(full);
            }
          }
        } else {
          assistantEl.textContent = "(empty response)";
        }
      } catch (e) {
        if (e.name === "AbortError") {
          assistantEl.textContent = (assistantEl.textContent || "") + "\n[stopped]";
        } else {
          assistantEl.classList.add("error");
          assistantEl.style.cssText = "align-self:flex-start;background:#5a2020;color:#ffe0e0;border:1px solid #aa5555;max-width:92%;padding:10px 12px;border-radius:10px;line-height:1.45;font-size:14px;white-space:pre-wrap;word-break:break-word;";
          assistantEl.textContent = "Error: " + (e.message || String(e));
        }
      } finally {
        try { clearInterval(statusTimer); } catch { /* */ }
        this.isStreaming = false;
        sendBtn.textContent = "Send";
        sendBtn.classList.remove("stop");
        try {
          assistantEl.style.fontStyle = "normal";
          assistantEl.style.opacity = "1";
        } catch { /* */ }
      }
    };

    sendBtn.onclick = () => {
      if (this.isStreaming) this.stopStream();
      else send();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  renderSidebarChat(container) {
    try { container.innerHTML = ""; } catch { /* ignore */ }
    this.mountChatUI(container).catch((e) => {
      try {
        container.innerHTML = `<p style="padding:12px;color:#f66">WIT AI error: ${e.message}</p>`;
      } catch { /* ignore */ }
    });
  }

  async openPanel() {
    this.panelOpen = true;
    const page = this.$page;
    if (!page) return this.openMainMenuFallback();

    try {
      if (typeof page.settitle === "function") page.settitle("WIT AI");
      else if (typeof page.setTitle === "function") page.setTitle("WIT AI");
    } catch { /* ignore */ }

    // Prefer body container if available
    let host = page;
    try {
      if (typeof page.body === "object" && page.body) host = page.body;
      else if (page.querySelector?.(".page-body")) host = page.querySelector(".page-body");
    } catch { /* use page */ }

    if (host === page) {
      page.innerHTML = "";
    } else {
      host.innerHTML = "";
    }

    // Force fresh UI every open (avoids stale sidebar/page DOM after plugin update)
    await this.mountChatUI(host);

    try {
      page.show();
    } catch (e) {
      try {
        const actionStack = acode.require("actionStack");
        actionStack.push({ id: "witai-page", action: () => page.hide?.() });
        (document.getElementById("app") || document.body).appendChild(page);
      } catch {
        console.warn("WIT AI: could not show page", e);
        this.openMainMenuFallback();
      }
    }
  }

  openMainMenuFallback() {
    acode.select("WIT AI", [
      "Open chat panel",
      "Fix current file",
      "Generate code",
      "Multi-step agent",
      "Scaffold project",
      "Settings",
    ]).then((c) => {
      if (c === "Open chat panel") this.openPanel();
      else if (c === "Fix current file") this.quickAction("fix");
      else if (c === "Generate code") this.quickAction("generate");
      else if (c === "Multi-step agent") this.runAgent();
      else if (c === "Scaffold project") this.newProject();
      else if (c === "Settings") this.openSettings();
    });
  }

  async openSettings() {
    return this.withNativeDialog(async () => {
    const currentProvider = await this.getSetting("provider", "groq");
    const currentModel = await this.getSetting("model", "");
    const currentBase = await this.getSetting("base_url", "");

    const webOn = await this.getSetting("web_enabled", "1");
    const choice = await acode.select("WIT AI Settings", [
      `Provider: ${currentProvider}`,
      `Model: ${currentModel || "(default)"}`,
      "Profiles (save / load setups)",
      "Set Groq API Key",
      "Set OpenAI API Key",
      "Set Anthropic API Key",
      "Set Gemini API Key",
      "Set Hugging Face Token",
      "Set Custom / inference key",
      "Set Tavily API Key (web search)",
      "Set Firecrawl API Key (web search)",
      "Custom / inference URL",
      "Refresh remote models",
      "MCP / external services",
      `Web lookup: ${webOn === "0" ? "off" : webOn === "always" ? "always" : "auto"}`,
      "Test current provider",
      "Clear all keys",
      "Back",
    ]);

    if (choice?.startsWith("Provider:")) {
      const p = await acode.select("Default provider", [
        "groq", "openai", "anthropic", "gemini", "huggingface", "openai_compatible",
      ]);
      if (p) {
        await this.setSetting("provider", p);
        this.safeToast(`Provider → ${p}`);
      }
    } else if (choice?.startsWith("Model:")) {
      const p = await this.getSetting("provider", "groq");
      let list = [];
      try {
        const remote = await this.fetchRemoteModels();
        if (remote.length) list = remote;
      } catch { /* fallback */ }
      if (!list.length) list = this.MODELS[p] || [];
      if (list.length) {
        const labels = list.map((m) => m.label).slice(0, 40);
        const picked = await acode.select("Model", labels);
        if (picked) {
          const m = list.find((x) => x.label === picked);
          if (m) {
            if (m.id === "custom") {
              const custom = await acode.prompt("Custom model ID", currentModel || "");
              if (custom) await this.setSetting("model", custom.trim());
            } else {
              await this.setSetting("model", m.id);
            }
            this.safeToast("Model saved");
          }
        }
      } else {
        const model = await acode.prompt("Model id", currentModel || "");
        if (model) await this.setSetting("model", model.trim());
      }
    } else if (choice === "Profiles (save / load setups)") {
      await this.manageProfiles();
    } else if (choice === "Set Groq API Key") {
      const key = await this.promptKey("Groq API Key (gsk_…)");
      if (key !== null) {
        await this.setKey("groq", key);
        const v = await this.getKey("groq");
        this.safeToast(v ? "Groq key saved (" + v.slice(0, 6) + "…)" : "Cleared");
      }
    } else if (choice === "Set OpenAI API Key") {
      const key = await this.promptKey("OpenAI API Key (sk-…)");
      if (key !== null) {
        await this.setKey("openai", key);
        const v = await this.getKey("openai");
        this.safeToast(v ? "OpenAI key saved (" + v.slice(0, 6) + "…)" : "Cleared");
      }
    } else if (choice === "Set Anthropic API Key") {
      const key = await this.promptKey("Anthropic API Key (sk-ant-…)");
      if (key !== null) {
        await this.setKey("anthropic", key);
        const v = await this.getKey("anthropic");
        this.safeToast(v ? "Anthropic key saved (" + v.slice(0, 8) + "…)" : "Cleared");
      }
    } else if (choice === "Set Gemini API Key") {
      const key = await this.promptKey("Gemini API Key (Google AI Studio)");
      if (key !== null) {
        await this.setKey("gemini", key);
        const v = await this.getKey("gemini");
        this.safeToast(v ? "Gemini key saved (" + v.slice(0, 6) + "…)" : "Cleared");
      }
    } else if (choice === "Set Hugging Face Token") {
      const key = await this.promptKey("Hugging Face Token (hf_…)");
      if (key !== null) {
        await this.setKey("huggingface", key);
        const v = await this.getKey("huggingface");
        this.safeToast(v ? "HF token saved (" + v.slice(0, 6) + "…)" : "Cleared");
      }
    } else if (choice === "Set Tavily API Key (web search)") {
      const key = await this.promptKey("Tavily API Key (tvly-… or empty for keyless)");
      if (key !== null) {
        await this.setKey("tavily", key);
        const v = await this.getKey("tavily");
        this.safeToast(v ? "Tavily key saved (" + v.slice(0, 6) + "…)" : "Tavily keyless mode");
      }
    } else if (choice === "Set Firecrawl API Key (web search)") {
      const key = await this.promptKey("Firecrawl API Key (or empty for keyless)");
      if (key !== null) {
        await this.setKey("firecrawl", key);
        const v = await this.getKey("firecrawl");
        this.safeToast(v ? "Firecrawl key saved (" + v.slice(0, 6) + "…)" : "Firecrawl keyless mode");
      }
    } else if (choice === "Set Custom / inference key") {
      const key = await this.promptKey("Custom / inference API key");
      if (key !== null) {
        await this.setKey("openai_compatible", key);
        const v = await this.getKey("openai_compatible");
        this.safeToast(v ? "Inference key saved (" + v.slice(0, 6) + "…)" : "Cleared");
      }
    } else if (choice === "Custom / inference URL") {
      const labels = this.ENDPOINT_PRESETS.map((p) => p.label);
      const picked = await acode.select("Endpoint preset", labels);
      if (picked) {
        const preset = this.ENDPOINT_PRESETS.find((p) => p.label === picked);
        if (preset?.id === "custom" || !preset?.url) {
          const url = await acode.prompt(
            "Base URL (e.g. https://api.openai.com/v1)",
            currentBase || "https://api.openai.com/v1"
          );
          if (url !== null) {
            await this.setSetting("base_url", url.trim());
            await this.setSetting("provider", "openai_compatible");
            this.safeToast("Custom URL saved");
          }
        } else {
          await this.setSetting("base_url", preset.url);
          await this.setSetting("provider", "openai_compatible");
          this.safeToast("Endpoint → " + preset.label);
        }
      }
    } else if (choice === "Refresh remote models") {
      try {
        acode.loader?.show?.("Fetching models…");
        const remote = await this.fetchRemoteModels();
        acode.loader?.hide?.();
        acode.alert("Remote models", remote.length
          ? remote.slice(0, 30).map((m) => m.id).join("\n")
          : "None returned (endpoint may not support /v1/models)");
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("Models", e.message);
      }
    } else if (choice === "MCP / external services") {
      await this.configureMcp();
    } else if (choice === "Test current provider") {
      try {
        acode.loader?.show?.("Testing connection…");
        const reply = await this.callLLM([
          { role: "user", content: "Reply with exactly: WIT AI connected" },
        ], { max_tokens: 32 });
        acode.loader?.hide?.();
        acode.alert("Connection", reply || "(empty — check key + base URL)");
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("Connection failed", e.message);
      }
    } else if (choice?.startsWith("Web lookup:")) {
      const mode = await acode.select("Web lookup", ["auto", "always", "off"]);
      if (mode) {
        await this.setSetting("web_enabled", mode === "off" ? "0" : mode);
        this.safeToast("Web lookup → " + mode);
      }
    } else if (choice === "Clear all keys") {
      await this.setKey("groq", "");
      await this.setKey("openai", "");
      await this.setKey("anthropic", "");
      await this.setKey("gemini", "");
      await this.setKey("huggingface", "");
      await this.setKey("openai_compatible", "");
      await this.setKey("tavily", "");
      await this.setKey("firecrawl", "");
      this.safeToast("Keys cleared");
    }
    }); // withNativeDialog
  }

}

if (window.acode) {
  const wit = new WitAI();

  // Official plugin settings page (Plugins → WIT AI → Settings gear)
  const pluginSettings = {
    list: [
      {
        key: "provider",
        text: "AI Provider",
        info: "Which service to use for chat / agent",
        select: [
          ["groq", "Groq"],
          ["openai", "OpenAI"],
          ["anthropic", "Anthropic"],
          ["gemini", "Gemini"],
          ["huggingface", "Hugging Face"],
          ["openai_compatible", "Custom / inference"],
        ],
        value: "groq",
      },
      {
        key: "model",
        text: "Model ID",
        info: "Exact model id (or pick from chat dropdown after key is set)",
        prompt: "Model ID",
        promptType: "text",
        value: "gemini-3.8-flash",
      },
      {
        key: "gemini_api_key",
        text: "Gemini API Key",
        info: "From Google AI Studio — paste full key",
        prompt: "Gemini API Key",
        promptType: "text",
        value: "",
        valueText: (v) => (v ? "••••" + String(v).slice(-4) : "Not set — tap to paste"),
      },
      {
        key: "groq_api_key",
        text: "Groq API Key",
        info: "From console.groq.com",
        prompt: "Groq API Key",
        promptType: "text",
        value: "",
        valueText: (v) => (v ? "••••" + String(v).slice(-4) : "Not set — tap to paste"),
      },
      {
        key: "openai_api_key",
        text: "OpenAI API Key",
        prompt: "OpenAI API Key",
        promptType: "text",
        value: "",
        valueText: (v) => (v ? "••••" + String(v).slice(-4) : "Not set"),
      },
      {
        key: "anthropic_api_key",
        text: "Anthropic API Key",
        prompt: "Anthropic API Key",
        promptType: "text",
        value: "",
        valueText: (v) => (v ? "••••" + String(v).slice(-4) : "Not set"),
      },
      {
        key: "tavily_api_key",
        text: "Tavily API Key (web)",
        info: "Free tier ~1000/mo — leave empty for keyless mode",
        prompt: "Tavily API Key",
        promptType: "text",
        value: "",
        valueText: (v) => (v ? "••••" + String(v).slice(-4) : "Keyless / not set"),
      },
      {
        key: "firecrawl_api_key",
        text: "Firecrawl API Key (web)",
        info: "Free tier ~1000 credits/mo — empty = keyless",
        prompt: "Firecrawl API Key",
        promptType: "text",
        value: "",
        valueText: (v) => (v ? "••••" + String(v).slice(-4) : "Keyless / not set"),
      },
      {
        key: "base_url",
        text: "Custom base URL",
        info: "Only for Custom / inference provider",
        prompt: "Base URL",
        promptType: "text",
        value: "https://api.openai.com/v1",
      },
      {
        key: "web_enabled",
        text: "Web lookup",
        select: [["1", "Auto"], ["always", "Always"], ["0", "Off"]],
        value: "1",
      },
      {
        key: "open_chat",
        text: "Open WIT AI chat",
        value: true,
        valueText: () => "Tap to open",
      },
    ],
    async cb(key, value) {
      try {
        if (key === "provider" || key === "model" || key === "base_url" || key === "web_enabled") {
          await wit.setSetting(key, value);
          wit.safeToast("Saved " + key);
        }
        if (key === "gemini_api_key") {
          await wit.setKey("gemini", value || "");
          wit.safeToast(value ? "Gemini key saved" : "Gemini key cleared");
        }
        if (key === "groq_api_key") {
          await wit.setKey("groq", value || "");
          wit.safeToast(value ? "Groq key saved" : "Groq key cleared");
        }
        if (key === "openai_api_key") {
          await wit.setKey("openai", value || "");
          wit.safeToast(value ? "OpenAI key saved" : "Cleared");
        }
        if (key === "anthropic_api_key") {
          await wit.setKey("anthropic", value || "");
          wit.safeToast(value ? "Anthropic key saved" : "Cleared");
        }
        if (key === "tavily_api_key") {
          await wit.setKey("tavily", value || "");
          wit.safeToast(value ? "Tavily key saved" : "Tavily keyless");
        }
        if (key === "firecrawl_api_key") {
          await wit.setKey("firecrawl", value || "");
          wit.safeToast(value ? "Firecrawl key saved" : "Firecrawl keyless");
        }
        if (key === "open_chat") wit.openPanel();
      } catch (e) {
        acode.alert("WIT AI", "Save failed: " + (e.message || e));
      }
    },
  };

  acode.setPluginInit(
    plugin.id,
    async (baseUrl, $page, { cacheFile, cacheFileUrl, firstInit, ctx }) => {
      wit.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      await wit.init($page, cacheFile, cacheFileUrl, firstInit, ctx);
      // Sync settings page values from secrets when possible
      try {
        const p = await wit.getSetting("provider", "groq");
        const m = await wit.getSetting("model", "openai/gpt-oss-20b");
        const b = await wit.getSetting("base_url", "https://api.openai.com/v1");
        const item = (k) => pluginSettings.list.find((x) => x.key === k);
        if (item("provider")) item("provider").value = p;
        if (item("model")) item("model").value = m;
        if (item("base_url")) item("base_url").value = b;
      } catch { /* ignore */ }
    },
    pluginSettings
  );

  acode.setPluginUnmount(plugin.id, () => {
    wit.destroy();
  });
}
