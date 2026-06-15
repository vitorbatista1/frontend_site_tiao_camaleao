// ============================================================================
// PIXEL TRACKING — NOVO ARQUIVO (criado para rastreamento Meta + TikTok)
// ----------------------------------------------------------------------------
// Helpers centralizados de tracking. Importado pelos componentes React/Astro.
// Nada aqui dispara sozinho: são funções utilitárias chamadas nos pontos certos.
// ============================================================================

/** Lê um cookie pelo nome (ex: _fbp, _fbc). Retorna null se não existir. */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

/** Cookie _fbp (browser id do Meta), setado pelo pixel base. */
export function getFbp(): string | null {
  return getCookie("_fbp");
}

/**
 * Cookie _fbc (click id do Meta). Se não existir mas houver ?fbclid= na URL,
 * monta o fbc no formato exigido pela Meta: fb.1.<timestamp>.<fbclid>.
 */
export function getFbc(): string | null {
  const c = getCookie("_fbc");
  if (c) return c;
  if (typeof window === "undefined") return null;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (fbclid) return `fb.1.${Date.now()}.${fbclid}`;
  return null;
}

/** ID de sessão estável (sobrevive à navegação na mesma aba). */
export function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return "no-session";
  let s = sessionStorage.getItem("tc_session");
  if (!s) {
    s = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now());
    sessionStorage.setItem("tc_session", s);
  }
  return s;
}

/**
 * Bundle de tracking enviado ao backend junto com o pagamento.
 * O backend joga isso no metadata do MP, que volta no webhook e alimenta o CAPI.
 */
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

/** Dispara um evento no Meta Pixel (browser), com event_id para dedup com o CAPI. */
export function fbqTrack(event: string, params?: object, eventID?: string) {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  if (eventID) {
    (window as any).fbq("track", event, params || {}, { eventID });
  } else {
    (window as any).fbq("track", event, params || {});
  }
}

/** Dispara um evento no TikTok Pixel (browser), com event_id para dedup com o CAPI. */
export function ttqTrack(event: string, params?: object, eventId?: string) {
  if (typeof window === "undefined" || !(window as any).ttq) return;
  if (eventId) {
    (window as any).ttq.track(event, { ...(params || {}), event_id: eventId });
  } else {
    (window as any).ttq.track(event, params || {});
  }
}
