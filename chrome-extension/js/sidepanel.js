console.log("[Sidepanel] script starting, checking globals...");
console.log("[Sidepanel] createNeedle:", typeof createNeedle);
console.log("[Sidepanel] chrome.runtime.id:", chrome.runtime.id);

import { loadModel, isReady, complete, reset } from "./needle-agent.js";
import { executeTool, getToolSchemas, getCustomToolHandler } from "./tools-builtin.js";
import { ToolsEditor } from "./tools-editor.js";
import { maybeTranslate } from "./translator.js";
import { getSettings, saveSettings } from "./store.js";

let settings = {};
let toolsEditor = null;

// Global error catch: show in UI so you can see errors without DevTools
window.onerror = (msg, url, line, col, err) => {
  const detail = err ? (err.message + "\n" + (err.stack ?? "").split("\n").slice(0, 4).join("\n")) : (msg + " at " + url + ":" + line);
  console.error("[Sidepanel] uncaught:", detail);
  const ls = document.getElementById("loading-screen");
  if (ls && ls.style.display !== "none") {
    ls.innerHTML = `<div style="color:#ef4444;padding:16px;text-align:center;font-size:12px;">
      <p style="font-weight:600;">Script Error</p>
      <pre style="text-align:left;max-height:200px;overflow:auto;font-size:11px;word-break:break-all;">${detail}</pre>
      <button onclick="location.reload()" style="margin-top:8px;background:#f97316;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;">Reload</button>
    </div>`;
  }
};

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const loadingScreen = document.getElementById("loading-screen");
const loadingText = document.getElementById("loading-text");
const loadingBar = document.getElementById("loading-bar");
const statusDot = document.getElementById("status-dot");
const panelChat = document.getElementById("panel-chat");
const panelTools = document.getElementById("panel-tools");
const panelSettings = document.getElementById("panel-settings");

// Initialize
async function init() {
  settings = await getSettings();
  document.getElementById("setting-auto-translate").checked = settings.autoTranslate;
  document.getElementById("setting-max-steps").value = settings.maxSteps;

  setupTabs();
  setupInput();
  setupSettings();
  setupHints();
  await loadToolsEditor();
  await loadBuiltinTools();
  try {
    const customTools = toolsEditor.getAll();
    const schemas = getToolSchemas(customTools);
    const toolsJson = JSON.stringify(schemas);
    await loadModel(toolsJson, onProgress);
    onModelReady();
  } catch (e) {
    console.error("[Sidepanel] Load failed:", e);
    onLoadError(e.message + "\n\nStack: " + (e.stack ?? "").split("\n").slice(0, 4).join("\n"));
  }
}

function onProgress(msg) {
  console.log("[Sidepanel] progress:", msg);
  loadingText.textContent = msg;
  const mbMatch = msg.match(/([\d.]+)\s*MB/);
  if (mbMatch) {
    loadingBar.style.width = Math.min(100, (parseFloat(mbMatch[1]) / 14) * 100) + "%";
  } else if (msg.includes("Step 1")) {
    loadingBar.style.width = "10%";
  } else if (msg.includes("Step 2")) {
    loadingBar.style.width = "25%";
  } else if (msg.includes("Step 3")) {
    loadingBar.style.width = "50%";
  } else if (msg.includes("Step 4") || msg.includes("WASM engine loaded") || msg.includes("Weights loaded") || msg.includes("Tools initialized")) {
    loadingBar.style.width = "80%";
  } else if (msg.includes("Model ready")) {
    loadingBar.style.width = "100%";
  }
}

function onModelReady() {
  statusDot.className = "status-dot online";
  statusDot.title = "Model ready";
  loadingScreen.style.display = "none";
  panelChat.classList.remove("hidden");
  chatInput.disabled = false;
  btnSend.disabled = false;
}

function onLoadError(errMsg) {
  statusDot.className = "status-dot offline";
  statusDot.title = "Load failed";
  loadingScreen.innerHTML = `
    <div style="color:#ef4444;font-size:14px;text-align:center;padding:16px;">
      <p style="font-weight:600;margin-bottom:8px;">Failed to load model</p>
      <p style="font-size:12px;color:#909296;margin-bottom:16px;word-break:break-all;">${errMsg}</p>
      <button id="btn-retry" style="background:#f97316;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;">Retry</button>
    </div>`;
  document.getElementById("btn-retry").addEventListener("click", () => location.reload());
}

// Tab switching
function setupTabs() {
  const tabs = {
    "tab-chat": panelChat,
    "tab-tools": panelTools,
    "tab-settings": panelSettings,
  };

  Object.entries(tabs).forEach(([btnId, panel]) => {
    document.getElementById(btnId).addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.getElementById(btnId).classList.add("active");
      document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
      panel.classList.remove("hidden");
    });
  });
}

// Builtin tools display
async function loadBuiltinTools() {
  const items = document.getElementById("builtin-tool-items");
  const schemas = getToolSchemas();
  items.innerHTML = schemas
    .map((s) => `<span class="builtin-tool-tag" title="${escapeHtml(s.description)}">${escapeHtml(s.name)}</span>`)
    .join("");
}

// Tools editor
async function loadToolsEditor() {
  toolsEditor = new ToolsEditor("custom-tools-container");
  await toolsEditor.load();
  toolsEditor.render();
}

// Input handling
function setupInput() {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
  });

  btnSend.addEventListener("click", sendMessage);
}

// Hint clicks
function setupHints() {
  document.querySelectorAll(".hint").forEach((hint) => {
    hint.addEventListener("click", () => {
      chatInput.value = hint.dataset.prompt;
      sendMessage();
    });
  });
}

// Settings
function setupSettings() {
  document.getElementById("setting-auto-translate").addEventListener("change", async (e) => {
    settings.autoTranslate = e.target.checked;
    await saveSettings(settings);
  });

  document.getElementById("setting-max-steps").addEventListener("change", async (e) => {
    settings.maxSteps = parseInt(e.target.value) || 8;
    await saveSettings(settings);
  });

  document.getElementById("btn-reset-conversation").addEventListener("click", () => {
    reset();
    chatMessages.innerHTML = `
      <div class="welcome-msg">
        <div class="welcome-icon">N</div>
        <h3>Needle 2 Agent</h3>
        <p>Conversation reset. Ready for new tasks.</p>
      </div>`;
  });
}

// Core: Send message and run agent loop
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !isReady()) return;

  chatInput.value = "";
  chatInput.style.height = "auto";
  btnSend.disabled = true;

  addMessage("user", text);

  let query = text;
  const { original } = settings.autoTranslate ? await maybeTranslate(text) : { original: null };
  if (original) {
    addMessage("translated", `${original} -> ${query}`);
  }

  try {
    await runAgentLoop(query);
  } catch (e) {
    addMessage("error", `Error: ${e.message}`);
  } finally {
    btnSend.disabled = false;
    chatInput.focus();
  }
}

async function runAgentLoop(initialQuery) {
  const customTools = toolsEditor.getAll();
  let currentQuery = initialQuery;

  for (let step = 0; step < settings.maxSteps; step++) {
    const response = complete(currentQuery);
    const rtype = response.type;

    // Always log full response for debugging
    addMessage("agent", `[step ${step + 1}] type=${rtype}, conf=${(response.confidence ?? 0).toFixed(2)}`);

    if (rtype === "respond") {
      const reasoning = response.reasoning || "";
      addMessage("agent", `[done] ${reasoning}`);
      break;
    }

    if (rtype === "call") {
      const calls = response.function_calls || [];
      if (calls.length === 0) {
        addMessage("agent", "(refused - no matching tool, dumping full response)");
        addMessage("result", response);
        break;
      }

      for (const call of calls) {
        const { name, arguments: args } = call;
        addMessage("tool", name, args);

        const customHandler = getCustomToolHandler(name, customTools);
        const result = customHandler ? await customHandler(args) : await executeTool(name, args);
        addMessage("result", result);
        currentQuery = JSON.stringify(result);
      }
      continue;
    }

    addMessage("error", `Unknown response type: ${rtype}`);
    addMessage("result", response);
    break;
  }
}

// Message rendering
function addMessage(type, ...args) {
  const div = document.createElement("div");
  div.className = "msg-" + type;

  switch (type) {
    case "user":
      div.textContent = args[0];
      break;
    case "tool":
      div.innerHTML = `<span class="tool-name">${escapeHtml(args[0])}</span><br><span class="tool-args">${escapeHtml(JSON.stringify(args[1], null, 2))}</span>`;
      break;
    case "result":
      div.innerHTML = `<pre>${escapeHtml(formatResult(args[0]))}</pre>`;
      break;
    case "agent":
      div.textContent = args[0];
      break;
    case "translated":
      div.textContent = "Translated: " + args[0];
      break;
    case "error":
      div.textContent = args[0];
      break;
  }

  const welcome = chatMessages.querySelector(".welcome-msg");
  if (welcome) welcome.remove();

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatResult(obj) {
  if (typeof obj === "string") return obj;
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

// Start
console.log("[Sidepanel] calling init()...");
init().catch((e) => {
  console.error("[Sidepanel] init() crashed:", e);
  onLoadError("Init crashed: " + e.message);
});
