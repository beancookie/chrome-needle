let Module = null;
let modelReady = false;

export function isReady() {
  return modelReady;
}

export async function loadModel(toolsJson, onProgress) {
  if (modelReady) return;

  const t0 = performance.now();
  const log = (msg) => {
    const elapsed = (performance.now() - t0).toFixed(0);
    const full = `[Needle ${elapsed}ms] ${msg}`;
    console.log(full);
    onProgress?.(msg);
  };

  try {
    log("Step 1/4: Loading WASM engine...");
    console.log("[Needle] checking createNeedle global:", typeof createNeedle);

    Module = await createNeedle({
      locateFile: (path) => chrome.runtime.getURL("lib/" + path),
    });
    console.log("[Needle] Module keys:", Object.keys(Module).filter(k => k.startsWith("_")).slice(0, 20));
    await waitForInit(Module);
    log("WASM engine loaded");

    log("Step 2/4: Loading model weights (needle2.cact)...");
    const cactUrl = chrome.runtime.getURL("lib/needle2.cact");
    console.log("[Needle] cact URL:", cactUrl);
    const resp = await fetch(cactUrl);
    if (!resp.ok) throw new Error(`CACT fetch failed: HTTP ${resp.status}`);

    const cactBytes = new Uint8Array(await resp.arrayBuffer());
    console.log("[Needle] cact size:", (cactBytes.length / 1024 / 1024).toFixed(1), "MB");

    const cactPtr = Module._malloc(cactBytes.length);
    Module.HEAPU8.set(cactBytes, cactPtr);
    const ret = Module._needle_load(cactPtr, BigInt(cactBytes.length));
    Module._free(cactPtr);
    console.log("[Needle] needle_load returned:", ret);
    if (ret !== 0) throw new Error(`needle_load() returned ${ret}`);
    log("Weights loaded");

    log("Step 3/4: Initializing tools...");
    const sPtr = strToWasm("");
    const tPtr = strToWasm(toolsJson);
    const iPtr = 0;
    const initRet = Module._needle_init(sPtr, tPtr, iPtr);
    Module._free(sPtr); Module._free(tPtr);
    console.log("[Needle] needle_init returned:", initRet);
    if (initRet < 0) throw new Error(`needle_init() returned ${initRet}`);
    log("Tools initialized");

    modelReady = true;
    log("Step 4/4: Model ready!");
  } catch (e) {
    console.error("[Needle] LOAD FAILED:", e);
    throw e;
  }
}

export function complete(input) {
  if (!Module || !modelReady) throw new Error("Model not loaded");

  console.log("[Needle] complete input (first 200):", input.slice(0, 200));

  const inPtr = strToWasm(input);
  const outCap = 32768;
  const outPtr = Module._malloc(outCap);
  Module.HEAPU8.fill(0, outPtr, outPtr + outCap);

  const status = Module._needle_complete(inPtr, 1024, outPtr, outCap);
  Module._free(inPtr);

  console.log("[Needle] needle_complete status:", status, "outCap:", outCap);

  let end = outPtr;
  while (end < outPtr + outCap && Module.HEAPU8[end] !== 0) end++;
  const outLen = end - outPtr;
  console.log("[Needle] output bytes read:", outLen);

  let result;
  if (outLen > 0) {
    const text = new TextDecoder().decode(Module.HEAPU8.subarray(outPtr, end));
    Module._free(outPtr);
    console.log("[Needle] raw output text:", text);
    try {
      result = JSON.parse(text);
    } catch {
      console.warn("[Needle] JSON parse failed, raw:", text);
      result = { type: "respond", function_calls: [], reasoning: text, confidence: 0 };
    }
  } else {
    Module._free(outPtr);
    console.warn("[Needle] empty output, status:", status);
    result = { type: "respond", function_calls: [], reasoning: "", confidence: 0 };
  }

  console.log("[Needle] complete result:", result.type, result.function_calls?.length ?? 0, "calls, confidence:", result.confidence);
  return result;
}

export function reset() {
  if (Module && modelReady) {
    Module._needle_reset();
    console.log("[Needle] conversation reset");
  }
}

function strToWasm(str) {
  const bytes = new TextEncoder().encode(str + "\0");
  const ptr = Module._malloc(bytes.length);
  Module.HEAPU8.set(bytes, ptr);
  return ptr;
}

function waitForInit(mod) {
  return new Promise((resolve) => {
    if (mod._needle_init) { resolve(); return; }
    const check = () => {
      if (mod._needle_init) { resolve(); return; }
      setTimeout(check, 50);
    };
    check();
  });
}
