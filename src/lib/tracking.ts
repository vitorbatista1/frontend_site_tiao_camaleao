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
  const testCode = (window as any)._fbTestEventCode;
  const extraOpts: Record<string, string> = {};
  if (opts?.eventID) extraOpts.eventID = opts.eventID;
  if (testCode) extraOpts.test_event_code = testCode;
  (window as any).fbq("track", event, params || {}, Object.keys(extraOpts).length ? extraOpts : undefined);
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
  contents?: Array<{ id: string | number; quantity?: number; item_price?: number; title?: string; description?: string }>;
  num_items?: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// Configuração central de eventos — edite aqui para mudar pixel E CAPI juntos.
// Cada chave é o event_name exato que vai para fbq/ttq e para o backend.
// ═══════════════════════════════════════════════════════════════════════════
export const PIXEL_EVENTS: Record<string, Partial<Commerce>> = {
  Lead:             { currency: "BRL", value: 1,                                                              },
  InitiateCheckout: { currency: "BRL",             content_category: "checkout",       content_type: "product" },
  AddPaymentInfo:   { currency: "BRL",             content_category: "musica_digital", content_type: "product" },
  Purchase:         { currency: "BRL",             content_category: "musica_digital", content_type: "product" },
  ViewContent:      { currency: "BRL",             content_category: "catalogo",       content_type: "product" },
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
  em?: string | null;
  ph?: string | null;
  fn?: string | null;
  ln?: string | null;
  // campos ricos opcionais — se não informados, trackCapi monta automaticamente
  lead?: { name?: string; email?: string; phone?: string };
  checkout?: { currency: string; value: number; items: Array<{ id: string; name: string; quantity: number; price: number }> };
  children?: unknown[];
};

export function trackCapi(input: CapiInput): void {
  if (!API_URL) return;
  try {
    const t = getTrackingPayload();
    const normPhone = normalizePhoneBR(input.ph);

    // UTM params da URL atual
    const urlParams = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const utm: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
      const v = urlParams.get(k);
      if (v) utm[k] = v;
    });

    // attribution — detecta fbclid ou utm_source
    const fbclidParam = urlParams.get("fbclid");
    let attribution: Record<string, unknown> | undefined;
    if (fbclidParam || utm.utm_source) {
      const rawData: Record<string, string> = {};
      if (fbclidParam) rawData.fbclid = fbclidParam;
      if (utm.utm_source) rawData.utm_source = utm.utm_source;
      attribution = {
        source: fbclidParam ? "meta" : utm.utm_source,
        reason: fbclidParam ? "fbclid" : "utm_source",
        decided_at: new Date().toISOString(),
        raw_data: rawData,
        via: "url",
      };
    }

    // lead — usa o fornecido ou monta a partir dos campos crus
    const lead = input.lead ?? {
      name: [input.fn, input.ln].filter(Boolean).join(" ") || undefined,
      email: input.em ? input.em.trim().toLowerCase() : undefined,
      phone: normPhone ? "+" + normPhone : undefined,
    };

    // checkout — usa o fornecido ou monta a partir de value + content_ids
    const checkout = input.checkout ?? {
      currency: input.currency ?? "BRL",
      value: input.value ?? 0,
      items: [] as Array<{ id: string; name: string; quantity: number; price: number }>,
    };

    const body = {
      event_name: input.event_name,
      event_id: input.event_id,
      // lead e checkout no formato rico
      lead,
      checkout,
      content_ids: input.content_ids,
      contents: input.contents,
      children: input.children ?? [],
      // commerce
      value: input.value,
      currency: input.currency,
      content_name: input.content_name,
      content_category: input.content_category,
      content_type: input.content_type,
      num_items: input.num_items,
      // contexto de rastreio
      fbp: t.fbp,
      fbc: t.fbc,
      user_agent: t.user_agent,
      event_source_url: t.event_source_url,
      referrer: t.referrer,
      session_id: normPhone ?? t.session_id,
      geo: "BR",
      utm: Object.keys(utm).length ? utm : undefined,
      attribution,
      // PII crua — backend gera sha256
      em: input.em ? input.em.trim().toLowerCase() : null,
      ph: normPhone ?? input.ph ?? null,
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

// ═══════════════════════════════════════════════════════════════════════════
// Ponto de entrada principal — usa os defaults de PIXEL_EVENTS e garante que
// pixel e CAPI recebem os mesmos campos de commerce.
// Purchase NÃO vai para CAPI aqui: a conversão confirmada chega pelo webhook
// do Mercado Pago → backend → RabbitMQ → N8N.
// ═══════════════════════════════════════════════════════════════════════════
export function trackBoth(
  event: string,
  capi: CapiInput,
  user?: { email?: string | null; phone?: string | null; fullName?: string | null },
): void {
  const defaults = PIXEL_EVENTS[event] ?? {};
  const merged: CapiInput = { ...defaults, ...capi };

  const commerce: Commerce = {
    value: merged.value,
    currency: merged.currency,
    content_ids: merged.content_ids,
    content_name: merged.content_name,
    content_category: merged.content_category,
    content_type: merged.content_type,
    contents: merged.contents,
    num_items: merged.num_items,
  };

  trackPixel(event, commerce, { eventId: merged.event_id, user });
  // CAPI para todos os eventos, incluindo Purchase.
  // Purchase também chega pelo webhook MP (pixel.publisher.ts) — o mesmo event_id
  // garante que o Meta deduplique quando ambos chegarem.
  trackCapi(merged);
}
