const TOOL_NAMES = [
  "get_page_content",
  "click_element",
  "fill_form",
  "scroll_page",
  "open_tab",
  "close_tab",
  "switch_tab",
  "list_tabs",
  "add_bookmark",
  "search_bookmarks",
  "download_file",
  "take_screenshot",
  "notification",
  "clipboard_read",
  "clipboard_write",
  "fetch_api",
  "execute_script",
];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(tabId, action, params = {}) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: executeInPage,
      args: [action, params],
    });
    return results[0]?.result ?? null;
  } catch (e) {
    return { error: e.message };
  }
}

function executeInPage(action, params) {
  // This function is serialized and injected into the page
  switch (action) {
    case "get_content": {
      const body = document.body?.innerText?.slice(0, 8000) ?? "";
      const links = Array.from(document.querySelectorAll("a")).map((a) => ({
        text: a.textContent?.trim().slice(0, 80),
        href: a.href,
      })).slice(0, 50);
      const forms = Array.from(document.querySelectorAll("form")).map((f) => ({
        action: f.action,
        inputs: Array.from(f.querySelectorAll("input, textarea, select")).map(
          (el) => ({
            name: el.name,
            type: el.type || el.tagName.toLowerCase(),
            placeholder: el.placeholder,
            value: el.value?.slice(0, 60),
          })
        ),
      }));
      const buttons = Array.from(document.querySelectorAll("button, input[type=submit], a.button, a.btn")).map(
        (el) => ({
          text: el.textContent?.trim()?.slice(0, 60) ?? "",
          selector: el.id ? `#${el.id}` : `.${el.className?.split(" ")[0]}`,
          tag: el.tagName,
        })
      ).filter(b => b.text).slice(0, 30);
      return { url: location.href, title: document.title, body, links, forms, buttons };
    }
    case "click": {
      const selector = params.selector;
      const el = document.querySelector(selector);
      if (!el) {
        const byText = Array.from(
          document.querySelectorAll("button, a, input[type=submit], [role=button]")
        ).find((e) => e.textContent?.trim()?.includes(params.text ?? ""));
        if (byText) { byText.click(); return { clicked: true, by: "text" }; }
        return { error: `element not found: ${selector}` };
      }
      el.click();
      return { clicked: true, selector };
    }
    case "fill": {
      const fields = params.fields ?? {};
      const results = {};
      for (const [name, value] of Object.entries(fields)) {
        const el = document.querySelector(
          `[name="${name}"], #${name}, input[placeholder*="${name}"], textarea[placeholder*="${name}"]`
        );
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          results[name] = "filled";
        } else {
          results[name] = "not_found";
        }
      }
      return results;
    }
    case "scroll": {
      window.scrollTo({ top: params.top ?? 0, left: params.left ?? 0, behavior: "smooth" });
      return { scrolled: true, top: window.scrollY };
    }
    default:
      return { error: `unknown action: ${action}` };
  }
}

// Handle messages from side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: e.message }));
  return true;
});

async function handleMessage(msg) {
  switch (msg.action) {
    case "get_page_content": {
      const tab = await getActiveTab();
      return sendToContent(tab.id, "get_content");
    }
    case "click_element": {
      const tab = await getActiveTab();
      return sendToContent(tab.id, "click", msg.params);
    }
    case "fill_form": {
      const tab = await getActiveTab();
      return sendToContent(tab.id, "fill", msg.params);
    }
    case "scroll_page": {
      const tab = await getActiveTab();
      return sendToContent(tab.id, "scroll", msg.params);
    }
    case "open_tab": {
      const tab = await chrome.tabs.create({ url: msg.params.url, active: msg.params.active ?? true });
      return { opened: true, tabId: tab.id, url: msg.params.url };
    }
    case "close_tab": {
      if (msg.params.tabId) {
        await chrome.tabs.remove(msg.params.tabId);
      } else {
        const tab = await getActiveTab();
        await chrome.tabs.remove(tab.id);
      }
      return { closed: true };
    }
    case "switch_tab": {
      const tabs = await chrome.tabs.query({});
      const target = tabs.find(
        (t) =>
          t.id === msg.params.tabId ||
          t.title?.toLowerCase().includes((msg.params.title ?? "").toLowerCase()) ||
          t.url?.toLowerCase().includes((msg.params.url ?? "").toLowerCase())
      );
      if (target) {
        await chrome.tabs.update(target.id, { active: true });
        return { switched: true, tabId: target.id, title: target.title };
      }
      return { error: "tab not found" };
    }
    case "list_tabs": {
      const tabs = await chrome.tabs.query({});
      return tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, active: t.active }));
    }
    case "add_bookmark": {
      await chrome.bookmarks.create({
        title: msg.params.title ?? "",
        url: msg.params.url ?? "",
      });
      return { bookmarked: true };
    }
    case "search_bookmarks": {
      const results = await chrome.bookmarks.search(msg.params.query ?? "");
      return results.slice(0, 20).map((b) => ({ title: b.title, url: b.url }));
    }
    case "download_file": {
      const id = await chrome.downloads.download({
        url: msg.params.url,
        filename: msg.params.filename ?? "",
      });
      return { downloading: true, downloadId: id };
    }
    case "take_screenshot": {
      const tab = await getActiveTab();
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });
      return { screenshot: dataUrl.slice(0, 100) + "..." };
    }
    case "notification": {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: msg.params.title ?? "Needle",
        message: msg.params.message ?? "",
      });
      return { notified: true };
    }
    case "clipboard_read": {
      // clipboard read requires the side panel to be focused
      return { error: "clipboard_read must be called from side panel directly" };
    }
    case "clipboard_write": {
      // clipboard write requires the side panel to be focused
      return { error: "clipboard_write must be called from side panel directly" };
    }
    case "fetch_api": {
      const resp = await fetch(msg.params.url, {
        method: msg.params.method ?? "GET",
        headers: msg.params.headers ?? {},
        body: msg.params.body ?? undefined,
      });
      const text = await resp.text();
      return { status: resp.status, body: text.slice(0, 4000) };
    }
    case "execute_script": {
      const tab = await getActiveTab();
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: new Function("params", msg.params.code),
          args: [msg.params.scriptParams ?? {}],
        });
        return { result: results[0]?.result ?? null };
      } catch (e) {
        return { error: e.message };
      }
    }
    default:
      return { error: `unknown tool: ${msg.action}` };
  }
}
