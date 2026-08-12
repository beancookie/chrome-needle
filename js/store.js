export async function getSettings() {
  const defaults = {
    maxSteps: 8,
    autoTranslate: true,
    customTools: [],
  };
  const stored = await chrome.storage.local.get("settings");
  return { ...defaults, ...(stored.settings ?? {}) };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}
