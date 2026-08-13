const ICIBA_URL =
  "https://dictionary.iciba.com/dictionary/fy/batch?client=6&key=1000006&timestamp=1786521741958&signature=2bf8daa41af4dd5a0075d9d27300cf08";

export function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

export async function translateZhToEn(text) {
  console.log("[Translator] translating:", text);
  try {
    const resp = await fetch(ICIBA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://www.iciba.com/",
      },
      body: JSON.stringify({ from: "zh", to: "en", textList: [text] }),
    });
    const data = await resp.json();
    console.log("[Translator] resp status:", resp.status, "code:", data.code);
    if (data.code === 1 && data.data?.length > 0) {
      console.log("[Translator] translated:", data.data[0].out);
      return data.data[0].out;
    }
    console.warn("[Translator] no translation, code:", data.code);
    return null;
  } catch (e) {
    console.error("[Translator] fetch failed:", e);
    return null;
  }
}

export async function maybeTranslate(text) {
  if (hasChinese(text)) {
    console.log("[Translator] hasChinese=true, translating:", text);
    const translated = await translateZhToEn(text);
    if (translated) {
      console.log("[Translator] translated:", text, "->", translated);
      return { text: translated, original: text };
    }
  }
  console.log("[Translator] skip translation");
  return { text, original: null };
}
