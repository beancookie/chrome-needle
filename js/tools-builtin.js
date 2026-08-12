const BUILTIN_TOOL_SCHEMAS = [
  {
    name: "get_page_content",
    description: "Read, get, return, or summarize the current page content including text, links, forms, and clickable buttons. Use this when the user asks to read the page, get page content, see what is on the page, check the current tab, or fetch the webpage content.",
    parameters: { type: "object", properties: {}, required: [] },
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
    name: "search_web",
    description:
      "Search the web for a query and open the search results in a new browser tab. Use this whenever the user asks to search the web, google something, or look something up online.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query, e.g. 'AI news' or 'best restaurants in Hong Kong'" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_tabs",
    description: "List all currently open browser tabs with their IDs, titles, and URLs.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

export async function executeTool(name, args) {
  switch (name) {
    case "get_page_content":
    case "click_element":
    case "fill_form":
    case "scroll_page":
    case "open_tab":
    case "search_web":
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
