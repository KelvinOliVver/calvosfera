// Identificadores do aparelho usados pelo sistema anti-ban.
const KEY = "cs_device_id";

export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  // cópia extra para sobreviver a limpeza parcial
  document.cookie = `${KEY}=${id}; max-age=31536000; path=/; SameSite=Lax`;
  return id;
}

function restoreFromCookie() {
  const m = document.cookie.match(new RegExp(`${KEY}=([^;]+)`));
  if (m?.[1] && !localStorage.getItem(KEY)) localStorage.setItem(KEY, m[1]);
}

export async function getFingerprint() {
  let canvasData = "";
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "16px Arial";
      ctx.fillText("Calvosfera ハゲ 123", 2, 2);
      canvasData = c.toDataURL();
    }
  } catch {
    /* ignore */
  }
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height + "x" + screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? ""),
    canvasData,
  ].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getIdentity() {
  restoreFromCookie();
  return { device: getDeviceId(), fp: await getFingerprint() };
}

export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@calvosfera.app`;
