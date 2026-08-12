const COMMON_TOOLS_TEMPLATES = [
  {
    name: "read_article",
    description: "Extract the main article content from the current page and summarize key points.",
    code: `const article = document.querySelector('article') || document.body;
const text = article.innerText.slice(0, 3000);
const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.trim());
return { text, headings };`,
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_and_navigate",
    description: "Type a query into a search box on the page and optionally submit it.",
    code: `const inputs = document.querySelectorAll('input[type=search], input[type=text], textarea');
let found = false;
for (const input of inputs) {
  const placeholder = (input.placeholder || '').toLowerCase();
  const name = (input.name || '').toLowerCase();
  if (placeholder.includes('search') || placeholder.includes('查找') || placeholder.includes('搜索') || name.includes('search') || name.includes('q') || name.includes('query')) {
    input.value = params.query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (params.submit) {
      const form = input.closest('form');
      if (form) { form.submit(); return { submitted: true, query: params.query }; }
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }
    found = true;
    return { filled: true, query: params.query, selector: input.name || input.id || 'input' };
  }
}
if (!found) return { error: 'No search input found on this page' };`,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query to type" },
        submit: { type: "boolean", description: "Whether to submit the search form after typing" },
      },
      required: ["query"],
    },
  },
  {
    name: "copy_page_text",
    description: "Copy a specific section or the visible text from the current page to clipboard.",
    code: `let text;
if (params.selector) {
  const el = document.querySelector(params.selector);
  text = el ? el.innerText : '';
} else {
  text = document.body.innerText.slice(0, 5000);
}
navigator.clipboard.writeText(text);
return { copied: true, length: text.length };`,
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the section to copy (copy whole page if omitted)" },
      },
      required: [],
    },
  },
];

export class ToolsEditor {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.customTools = [];
    this.selectedIndex = -1;
  }

  async load() {
    const stored = await chrome.storage.local.get("customTools");
    this.customTools = stored.customTools ?? [];
  }

  async save() {
    await chrome.storage.local.set({ customTools: this.customTools });
  }

  getAll() {
    return this.customTools;
  }

  render() {
    this.container.innerHTML = `
      <div class="tools-editor-header">
        <h4>Custom Script Tools</h4>
        <button id="btn-add-tool" class="btn-small">+ New Tool</button>
      </div>
      <div id="tool-templates" class="tool-templates">
        <span class="templates-label">Templates:</span>
        ${COMMON_TOOLS_TEMPLATES.map(
          (t, i) => `<button class="btn-template" data-idx="${i}">${t.name}</button>`
        ).join("")}
      </div>
      <div id="tool-list" class="tool-list"></div>
      <div id="tool-editor-panel" class="tool-editor-panel hidden"></div>
    `;

    document.getElementById("btn-add-tool")?.addEventListener("click", () => this.showEditor(-1));
    this.container.querySelectorAll(".btn-template").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        this.customTools.push({ ...COMMON_TOOLS_TEMPLATES[idx] });
        this.save().then(() => this.render());
      });
    });

    this.renderToolList();
  }

  renderToolList() {
    const list = document.getElementById("tool-list");
    if (!list) return;
    if (this.customTools.length === 0) {
      list.innerHTML = '<div class="tool-list-empty">No custom scripts yet. Click "+ New Tool" or pick a template above.</div>';
      return;
    }
    list.innerHTML = this.customTools
      .map(
        (t, i) => `
      <div class="tool-card ${this.selectedIndex === i ? "selected" : ""}" data-idx="${i}">
        <div class="tool-card-header">
          <strong>${escapeHtml(t.name)}</strong>
          <div class="tool-card-actions">
            <button class="btn-edit-icon" data-action="edit" data-idx="${i}" title="Edit">Edit</button>
            <button class="btn-delete-icon" data-action="delete" data-idx="${i}" title="Delete">Delete</button>
          </div>
        </div>
        <div class="tool-card-desc">${escapeHtml(t.description ?? "")}</div>
      </div>`
      )
      .join("");

    list.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        if (btn.dataset.action === "edit") this.showEditor(idx);
        if (btn.dataset.action === "delete") {
          this.customTools.splice(idx, 1);
          this.save().then(() => this.render());
        }
      });
    });

    list.querySelectorAll(".tool-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.showEditor(parseInt(card.dataset.idx));
      });
    });
  }

  showEditor(index) {
    this.selectedIndex = index;
    const isNew = index < 0 || index >= this.customTools.length;
    const tool = isNew ? { name: "", description: "", code: "// Write your JavaScript here\n// Access params argument for input\nreturn { result: params };" } : { ...this.customTools[index] };

    const panel = document.getElementById("tool-editor-panel");
    panel.className = "tool-editor-panel";
    panel.innerHTML = `
      <h4>${isNew ? "New Tool" : "Edit Tool"}</h4>
      <label for="tool-name">Name</label>
      <input id="tool-name" type="text" placeholder="e.g. read_article" value="${escapeHtml(tool.name)}" />
      <label for="tool-desc">Description</label>
      <input id="tool-desc" type="text" placeholder="What does this tool do? (shown to the model)" value="${escapeHtml(tool.description ?? "")}" />
      <label for="tool-code">JavaScript Code</label>
      <textarea id="tool-code" rows="10" placeholder="// JS code that runs on the page. Use 'params' for input.">${escapeHtml(tool.code)}</textarea>
      <div class="tool-editor-actions">
        <button id="btn-save-tool">Save</button>
        <button id="btn-cancel-tool" class="btn-secondary">Cancel</button>
      </div>
    `;

    document.getElementById("btn-save-tool").addEventListener("click", async () => {
      const name = document.getElementById("tool-name").value.trim();
      const description = document.getElementById("tool-desc").value.trim();
      const code = document.getElementById("tool-code").value;

      if (!name || !description) {
        alert("Name and description are required.");
        return;
      }

      try {
        new Function("params", code);
      } catch (e) {
        alert(`JavaScript syntax error: ${e.message}`);
        return;
      }

      const saved = { name, description, code, parameters: { type: "object", properties: {}, required: [] } };
      if (isNew) {
        this.customTools.push(saved);
      } else {
        this.customTools[index] = saved;
      }
      await this.save();
      panel.className = "tool-editor-panel hidden";
      this.render();
    });

    document.getElementById("btn-cancel-tool").addEventListener("click", () => {
      panel.className = "tool-editor-panel hidden";
      this.renderToolList();
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}
