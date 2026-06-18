export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function getFbp(): string | null {
  return getCookie("_fbp");
}

export function getFbc(): string | null {
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
