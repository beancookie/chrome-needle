chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "content") return;

  try {
    switch (msg.action) {
      case "get_page_element_info": {
        const el = document.activeElement;
        sendResponse({
          tag: el?.tagName,
          type: el?.type,
          name: el?.name,
          placeholder: el?.placeholder,
          value: el?.value?.slice(0, 200),
        });
        break;
      }
      case "highlight_selector": {
        const el = document.querySelector(msg.selector);
        if (el) {
          el.style.outline = "3px solid #f97316";
          setTimeout(() => (el.style.outline = ""), 3000);
          sendResponse({ highlighted: true });
        } else {
          sendResponse({ error: "not found" });
        }
        break;
      }
      default:
        sendResponse({ error: "unknown content action" });
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
});
