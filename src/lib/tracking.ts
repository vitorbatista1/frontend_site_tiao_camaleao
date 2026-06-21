const API_URL = import.meta.env.PUBLIC_API_URL as string;
// [TC-CAPI 2026-06] mesmo ID do PixelHead — usado no advanced matching do browser
export const META_PIXEL_ID =
  (import.meta.env.PUBLIC_META_PIXEL_ID as string) || "2321147791624359";

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

// [TC-CAPI 2026-06] telefone BR canônico (13 díg: 55 + DDD + 9 + 8).
// IMPORTANTE: o N8N tem que normalizar IGUAL para o external_id casar
// (sha256 do MESMO string nas duas pontas: browser e servidor).
export function normalizePhoneBR(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

// ═══════════════════════════════════════════════════════════════════════════
// [TC-CAPI 2026-06] ADVANCED MATCHING (browser).
// Passa os dados do contato CRUS — a fbevents.js NORMALIZA e faz SHA-256 no
// navegador automaticamente. NÃO criptografar manualmente aqui.
// Chamar assim que tiver nome/email/telefone; persiste para os próximos
// eventos da MESMA página (não atravessa troca de página).
//
// ⚠️ external_id = telefone normalizado, e SÓ é setado quando há telefone.
//    NUNCA usar um external_id fixo/constante — isso colapsa todos os usuários
//    numa identidade só e destrói a otimização. Sem telefone → sem external_id.
// ═══════════════════════════════════════════════════════════════════════════
export function setUserData(u: { email?: string | null; phone?: string | null; fullName?: string | null }): void {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  const am: Record<string, string> = { country: "br" };
  const email = (u.email || "").trim().toLowerCase();
  if (email) am.em = email;
  const ph = normalizePhoneBR(u.phone);
  if (ph) {
    am.ph = ph;
    am.external_id = ph; // mesma chave do CAPI/N8N → casa entre site, CTWA e portal meu.
  }
  const parts = (u.fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts[0]) am.fn = parts[0].toLowerCase();
  if (parts.length > 1) am.ln = parts.slice(1).join(" ").toLowerCase();
  (window as any).fbq("init", META_PIXEL_ID, am);
}

// [TC-CAPI 2026-06] parâmetros contextuais (NÃO-PII) comuns a todos os eventos.
export function getContext(): Record<string, any> {
  if (typeof window === "undefined") return {};
  return {
    page_title: document.title || undefined,
    page_referrer: document.referrer || undefined,
    event_source_url: location.href,
    source_platform: "meta",
    event_source: "browser",
    geo: "BR",
    country: "br",
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    session_id: getSessionId(),
  };
}

export function getTrackingPayload() {
  return {
    fbp: getFbp(),
    fbc: getFbc(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    event_source_url: typeof location !== "undefined" ? location.href : null,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    session_id: getSessionId(),
    // [TC-CAPI 2026-06] contexto extra para o CAPI
    page_title: typeof document !== "undefined" ? document.title || null : null,
    viewport_width: typeof window !== "undefined" ? window.innerWidth : null,
    viewport_height: typeof window !== "undefined" ? window.innerHeight : null,
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

// [TC-CAPI 2026-06] tipos de commerce (custom_data) — SEM PII.
export type Commerce = {
  value?: number;
  currency?: string;
  content_ids?: (string | number)[];
  content_name?: string;
  content_category?: string;
  content_type?: string;
  contents?: Array<{ id: string | number; quantity?: number; item_price?: number }>;
  num_items?: number;
};

// [TC-CAPI 2026-06] dispara o PIXEL enriquecido (advanced matching + commerce + contexto).
// REGRA: PII vai SÓ pelo setUserData (opts.user). Nunca dentro de `params`/custom_data.
export function trackPixel(
  event: string,
  commerce: Commerce,
  opts: { eventId?: string; user?: { email?: string | null; phone?: string | null; fullName?: string | null } } = {},
): void {
  if (opts.user) setUserData(opts.user);
  const params = { currency: "BRL", ...getContext(), ...commerce };
  fbqTrack(event, params, opts.eventId ? { eventID: opts.eventId } : undefined);
  ttqTrack(event, params, opts.eventId ? { event_id: opts.eventId } : undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// [TC-CAPI 2026-06] Disparo server-side via backend → N8N → Meta CAPI.
// NÃO chamamos o N8N direto do browser (o token JWT ficaria exposto).
// Mandamos email/telefone/nome CRUS — o hash SHA-256 é feito no N8N.
// `keepalive: true` garante o envio mesmo se a página navegar (caso do Lead → wa.me).
// ═══════════════════════════════════════════════════════════════════════════
type CapiInput = Commerce & {
  event_name: string;
  event_id: string;
  em?: string | null; // email cru (opcional)
  ph?: string | null; // telefone cru (opcional)
  fn?: string | null; // primeiro nome (opcional)
  ln?: string | null; // sobrenome (opcional)
};

export function trackCapi(input: CapiInput): void {
  if (!API_URL) return;
  try {
    const t = getTrackingPayload();
    const body = {
      event_name: input.event_name,
      event_id: input.event_id,
      // commerce (custom_data)
      value: input.value,
      currency: input.currency,
      content_ids: input.content_ids,
      content_name: input.content_name,
      content_category: input.content_category,
      content_type: input.content_type,
      contents: input.contents,
      num_items: input.num_items,
      // contexto
      fbp: t.fbp,
      fbc: t.fbc,
      user_agent: t.user_agent,
      event_source_url: t.event_source_url,
      referrer: t.referrer,
      session_id: t.session_id,
      page_title: t.page_title,
      viewport_width: t.viewport_width,
      viewport_height: t.viewport_height,
      country: "br",
      geo: "BR",
      source_platform: "meta",
      // PII crua (N8N hasheia) — vai no body, NUNCA no pixel custom_data.
      // external_id é derivado no N8N a partir do telefone (ph). Sem telefone → sem external_id.
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
  } catch (e) {
    /* nunca quebra a UX */
  }
}

/** [TC-CAPI 2026-06] Dispara pixel (enriquecido) E CAPI com o MESMO event_id → deduplica. */
export function trackBoth(
  event: string,
  capi: CapiInput,
  user?: { email?: string | null; phone?: string | null; fullName?: string | null },
): void {
  const commerce: Commerce = {
    value: capi.value,
    currency: capi.currency,
    content_ids: capi.content_ids,
    content_name: capi.content_name,
    content_category: capi.content_category,
    content_type: capi.content_type,
    contents: capi.contents,
    num_items: capi.num_items,
  };
  trackPixel(event, commerce, { eventId: capi.event_id, user });
  trackCapi(capi);
}
