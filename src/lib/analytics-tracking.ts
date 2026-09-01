// ═══════════════════════════════════════════════════════════════════════════
// [CS+GA4 2026-08] Rastreamento de funil — Contentsquare (pageview virtual)
// + GA4 (evento) disparados de um ÚNICO ponto.
//
// ⚠️ Este arquivo NÃO tem relação com `./tracking.ts` (Meta Pixel / TikTok /
//    CAPI). O guia pedia `src/lib/tracking.js`, mas esse nome já estava em
//    uso pelo Meta — por isso o helper vive aqui. Nada do Meta foi alterado.
//
// As tags base (gtag.js G-JMDLD91HJR e Contentsquare) já estão instaladas
// em `components/AnalyticsHead.astro`; aqui só empurramos os dados.
//
// Regra de disparo: cada ETAPA dispara no instante em que a tela fica visível,
// uma vez por exibição (voltar a uma etapa já vista = nova exibição).
// Nunca colocar nome da criança, e-mail, telefone ou qualquer PII em paths,
// nomes ou params.
//
// Os nomes abaixo são os que os painéis do CS e do GA4 já esperam.
// NÃO renomear, traduzir ou "melhorar".
// ═══════════════════════════════════════════════════════════════════════════

declare global {
  interface Window {
    _uxa?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// --- Primitivas ---
function csPageview(path: string): void {
  if (typeof window === 'undefined') return;
  window._uxa = window._uxa || [];
  window._uxa.push(['trackPageview', path]);
}
function csEvent(nome: string): void {
  if (typeof window === 'undefined') return;
  window._uxa = window._uxa || [];
  window._uxa.push(['trackPageEvent', nome]);
}
function ga4(evento: string, params: Record<string, string | number> = {}): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag === 'function') window.gtag('event', evento, params);
}

// --- ETAPAS de funil ---------------------------------------------------------
// [v3] O mapa de etapas e o `trackStep` MIGRARAM para `./stepNavigation.ts`
// (goToStep = URL via pushState + CS + GA4 num único ponto). Este arquivo fica
// só com ações/clique e checkout. Re-exportado p/ compatibilidade de import:
export { STEPS, goToStep, type StepKey } from './stepNavigation';

/**
 * Evento de CHECKOUT — chamado uma vez no carregamento de /pagamento
 * (ver `pages/pagamento.astro`). No Contentsquare o /pagamento já é
 * pageview real automático; aqui só o GA4.
 */
export function trackCheckout(): void {
  ga4('chegou_checkout');
}

/**
 * Evento de AÇÃO/clique (não é etapa de funil).
 * Opcionalmente re-dispara um pageview virtual do CS (ex.: "voltar ao início").
 * @param ga4Event         nome do evento no GA4 (snake_case)
 * @param opts.csEvent     nome do evento no CS (formato "grupo|acao")
 * @param opts.csPageview  path virtual do CS a re-disparar
 * @param opts.params      params do GA4 (sem PII)
 */
export function trackAction(
  ga4Event: string,
  { csEvent: cse, csPageview: csp, params = {} }: {
    csEvent?: string;
    csPageview?: string;
    params?: Record<string, string | number>;
  } = {},
): void {
  if (csp) csPageview(csp);
  if (cse) csEvent(cse);
  ga4(ga4Event, params);
}

/**
 * Slug estável para identificar produto em eventos (sem espaços/acentos/PII).
 * Ex.: "Álbum 1" → "album-1", "Coleção Completa" → "colecao-completa".
 */
export function slugProduto(nome: string): string {
  return String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'produto';
}

// ---------------------------------------------------------------------------
// Ponte para scripts `is:inline` (que não conseguem `import`) — usada pelo
// ModalVanilla.astro. Chamado por um <script> bundlado no próprio componente.
// ---------------------------------------------------------------------------
export function exposeOnWindow(): void {
  if (typeof window === 'undefined') return;
  (window as any).__tcFunnel = { trackAction, trackCheckout };
}
