const API_URL = import.meta.env.PUBLIC_API_URL as string;

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function getFbp(): string | null {
  return getCookie("_fbp");
}

export function getFbc(): string | null {
  // [TC-CAPI 2026-06] lê o cookie _fbc primeiro (timestamp correto do clique);
  // só reconstrói a partir do fbclid se o cookie não existir.
  const c = getCookie("_fbc");
  if (c) return c;
  if (typeof window === "undefined") return null;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (fbclid) return `fb.1.${Date.now()}.${fbclid}`;
  return null;
}

export function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return "no-session";
  let s = sessionStorage.getItem("tc_session");
  if (!s) {
    s = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now());
    sessionStorage.setItem("tc_session", s);
  }
  return s;
}

export function getTrackingPayload() {
  return {
    fbp: getFbp(),
    fbc: getFbc(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    event_source_url: typeof location !== "undefined" ? location.href : null,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    session_id: getSessionId(),
  };
}

export function fbqTrack(event: string, params?: object, opts?: { eventID?: string }) {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  if (opts?.eventID) {
    (window as any).fbq("track", event, params || {}, { eventID: opts.eventID });
  } else {
    (window as any).fbq("track", event, params || {});
  }
}

export function ttqTrack(event: string, params?: object, opts?: { event_id?: string }) {
  if (typeof window === "undefined" || !(window as any).ttq) return;
  if (opts?.event_id) {
    (window as any).ttq.track(event, { ...(params || {}), event_id: opts.event_id });
  } else {
    (window as any).ttq.track(event, params || {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// [TC-CAPI 2026-06] Disparo server-side via backend → N8N → Meta CAPI.
// NÃO chamamos o N8N direto do browser (o token JWT ficaria exposto).
// Mandamos email/telefone CRUS — o hash SHA-256 é feito no N8N.
// `keepalive: true` garante o envio mesmo se a página navegar (caso do Lead → wa.me).
// ═══════════════════════════════════════════════════════════════════════════
type CapiInput = {
  event_name: string;
  event_id: string;
  value?: number;
  currency?: string;
  content_ids?: (string | number)[];
  content_name?: string;
  num_items?: number;
  em?: string | null;   // email cru (opcional)
  ph?: string | null;   // telefone cru (opcional)
  fn?: string | null;   // primeiro nome (opcional)
  ln?: string | null;   // sobrenome (opcional)
};

export function trackCapi(input: CapiInput): void {
  if (!API_URL) return;
  try {
    const t = getTrackingPayload();
    const body = {
      event_name: input.event_name,
      event_id: input.event_id,
      value: input.value,
      currency: input.currency,
      content_ids: input.content_ids,
      content_name: input.content_name,
      num_items: input.num_items,
      fbp: t.fbp,
      fbc: t.fbc,
      user_agent: t.user_agent,
      event_source_url: t.event_source_url,
      referrer: t.referrer,
      session_id: t.session_id,
      em: input.em ?? null,
      ph: input.ph ?? null,
      fn: input.fn ?? null,
      ln: input.ln ?? null,
    };
    fetch(`${API_URL}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* nunca quebra a UX */ }
}

/** Dispara o pixel (browser) E o CAPI (server) com o MESMO event_id → deduplica. */
export function trackBoth(
  event: string,
  params: object,
  capi: CapiInput,
): void {
  fbqTrack(event, params, { eventID: capi.event_id });
  ttqTrack(event, params, { event_id: capi.event_id });
  trackCapi(capi);
}
