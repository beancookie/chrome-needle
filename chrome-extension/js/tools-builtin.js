const BUILTIN_TOOL_SCHEMAS = [
  {
    name: "get_page_content",
    description: "Read, get, return, or summarize the current page content including text, links, forms, and clickable buttons. Use this when the user asks to read the page, get page content, see what is on the page, check the current tab, or fetch the webpage content.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "click_element",
    description: "Click an element on the current page by CSS selector or by its visible text.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click (e.g. '#submit', '.btn-primary')" },
        text: { type: "string", description: "Visible text of the button/link to click, used when selector is unknown" },
      },
      required: [],
    },
  },
  {
    name: "fill_form",
    description: "Fill form fields on the current page. Pass field names and values to fill.",
    parameters: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          description: "Map of field names to values to fill (e.g. {'username': 'john', 'password': '123456'})",
        },
      },
      required: ["fields"],
    },
  },
  {
    name: "scroll_page",
    description: "Scroll the current page to a specific position.",
    parameters: {
      type: "object",
      properties: {
        top: { type: "integer", description: "Pixels from top to scroll to" },
      },
      required: [],
    },
  },
  {
    name: "open_tab",
    description: "Open a new browser tab with the given URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to open (e.g. 'https://www.google.com')" },
        active: { type: "boolean", description: "Whether to switch to the new tab immediately" },
      },
      required: ["url"],
    },
  },
  {
    name: "close_tab",
    description: "Close a browser tab by its tab ID, or close the current tab if no ID given.",
    parameters: {
      type: "object",
      properties: {
        tabId: { type: "integer", description: "ID of the tab to close (omit to close current tab)" },
      },
      required: [],
    },
  },
  {
    name: "switch_tab",
    description: "Switch to a specific tab by its ID, title keyword, or URL keyword.",
    parameters: {
      type: "object",
      properties: {
        tabId: { type: "integer", description: "ID of the tab" },
        title: { type: "string", description: "Keyword in the tab title" },
        url: { type: "string", description: "Keyword in the tab URL" },
      },
      required: [],
    },
  },
  {
    name: "list_tabs",
    description: "List all currently open browser tabs with their IDs, titles, and URLs.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_bookmark",
    description: "Bookmark the current page or a specific URL.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title for the bookmark" },
        url: { type: "string", description: "URL to bookmark (uses current page if omitted)" },
      },
      required: ["url"],
    },
  },
  {
    name: "search_bookmarks",
    description: "Search through browser bookmarks by keyword.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword to search in bookmark titles and URLs" },
      },
      required: ["query"],
    },
  },
  {
    name: "download_file",
    description: "Download a file from a URL to the local machine.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the file to download" },
        filename: { type: "string", description: "Suggested filename for the download" },
      },
      required: ["url"],
    },
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of the current visible browser tab.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "notification",
    description: "Show a system desktop notification.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title" },
        message: { type: "string", description: "Notification body text" },
      },
      required: ["title", "message"],
    },
  },
  {
    name: "clipboard_write",
    description: "Copy text to the system clipboard.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to copy to clipboard" },
      },
      required: ["text"],
    },
  },
  {
    name: "fetch_api",
    description: "Make an HTTP request to an external API or website.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to request" },
        method: { type: "string", description: "HTTP method: GET, POST, PUT, DELETE" },
        headers: { type: "object", description: "Request headers as key-value pairs" },
        body: { type: "string", description: "Request body for POST/PUT" },
      },
      required: ["url"],
    },
  },
  {
    name: "execute_script",
    description: "Run a custom JavaScript function in the context of the current page. The code receives a 'params' argument.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript function body to execute in the page context" },
        scriptParams: { type: "object", description: "Parameters to pass to the script" },
      },
      required: ["code"],
    },
  },
];

export async function executeTool(name, args) {
  switch (name) {
    case "get_page_content":
    case "click_element":
    case "fill_form":
    case "scroll_page":
    case "open_tab":
    case "close_tab":
    case "switch_tab":
    case "list_tabs":
    case "add_bookmark":
    case "search_bookmarks":
    case "download_file":
    case "take_screenshot":
    case "notification":
    case "fetch_api":
    case "execute_script":
      return chrome.runtime.sendMessage({ action: name, params: args });

    case "clipboard_read":
      try {
        return { text: await navigator.clipboard.readText() };
      } catch (e) {
        return { error: e.message };
      }

    case "clipboard_write":
      try {
        await navigator.clipboard.writeText(args.text);
        return { copied: true };
      } catch (e) {
        return { error: e.message };
      }

    default:
      return { error: `unknown tool: ${name}` };
  }
}

export function getToolSchemas(customTools = []) {
  const customSchemas = customTools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters ?? { type: "object", properties: {}, required: [] },
  }));
  return [...BUILTIN_TOOL_SCHEMAS, ...customSchemas];
}

export function getCustomToolHandler(name, customTools) {
  const tool = customTools.find((t) => t.name === name);
  if (!tool) return null;
  try {
    const fn = new Function("params", tool.code);
    return (args) => {
      try {
        return Promise.resolve(fn(args));
      } catch (e) {
        return { error: e.message };
      }
    };
  } catch {
    return null;
  }
}
