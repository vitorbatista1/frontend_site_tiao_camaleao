// ═══════════════════════════════════════════════════════════════════════════
// [CS+GA4 2026-08 v3] Navegação central de ETAPAS com URL (history.pushState)
//
// ÚNICA porta de entrada para trocar de etapa no quiz /presente e no modal da
// LP. Faz, nesta ordem: (1) atualiza a URL sem recarregar, (2) avisa a UI via
// evento `step:change`, (3) dispara Contentsquare (pageview virtual) + GA4.
//
// ⚠️ META PIXEL / CAPI — proteção obrigatória:
//    `src/lib/tracking.ts` (Meta) lê `location.search` (fbclid / utm_*) e
//    `location.href` NO MOMENTO de cada evento. Por isso o pushState aqui
//    SEMPRE preserva `location.search` e `location.hash` — só o pathname muda.
//    Assim fbclid/UTMs continuam presentes em Lead/InitiateCheckout/Purchase e
//    o EMQ não é afetado. Nada deste arquivo chama fbq() ou toca o Pixel.
//
// Os paths/eventos abaixo são CONTRATOS com os painéis do CS e do GA4.
// NÃO renomear.
// ═══════════════════════════════════════════════════════════════════════════

declare global {
  interface Window {
    _uxa?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const STEPS = {
  // /presente — `presente_nome` é o load real (page_view nativo) → ga4: null
  presente_nome:             { path: '/presente',                           ga4: null as string | null },
  presente_amostras:         { path: '/presente/2-amostras',                ga4: 'presente_amostras' },
  presente_produtos:         { path: '/presente/3-produtos',                ga4: 'presente_produtos' },
  presente_resumo:           { path: '/presente/4-resumo',                  ga4: 'presente_resumo' },
  presente_dados:            { path: '/presente/5-dados',                   ga4: 'presente_dados' },
  presente_oferta_relampago: { path: '/presente/oferta-relampago',          ga4: 'presente_oferta_relampago' },
  // modal da LP (base = '/')
  modal_lead:                { path: '/modal-compra/1-lead',                ga4: 'modal_lead' },
  modal_qtd_criancas:        { path: '/modal-compra/2-quantidade-criancas', ga4: 'modal_qtd_criancas' },
  modal_nomes_produtos:      { path: '/modal-compra/3-nomes-e-produtos',    ga4: 'modal_nomes_produtos' },
} as const;

export type StepKey = keyof typeof STEPS;
type Params = Record<string, string | number>;

export function track(path: string, ga4Event: string | null, params: Params = {}): void {
  if (typeof window === 'undefined') return;
  window._uxa = window._uxa || [];
  window._uxa.push(['trackPageview', path]);
  if (ga4Event && typeof window.gtag === 'function') window.gtag('event', ga4Event, params);
}

let lastPath: string | null = null;

/** Mantém a query string (fbclid/utm) e o hash — ver aviso META no topo. */
function urlFor(path: string): string {
  return path + location.search + location.hash;
}

export interface GoToStepOpts {
  replace?: boolean;
  params?: Params;
  silent?: boolean;
  /** Estado extra guardado no history (ex.: qual `tela` do quiz) p/ restaurar no popstate. */
  state?: Record<string, unknown>;
}

/**
 * Única porta de entrada para trocar de etapa.
 * Idempotente: se o path já é o atual, não empurra nem dispara de novo.
 */
export function goToStep(stepKey: StepKey, opts: GoToStepOpts = {}): void {
  if (typeof window === 'undefined') return;
  const step = STEPS[stepKey];
  if (!step) { console.warn('[nav] etapa desconhecida:', stepKey); return; }
  if (step.path === lastPath) return;
  lastPath = step.path;

  const method = opts.replace ? 'replaceState' : 'pushState';
  try {
    history[method]({ stepKey, ...(opts.state || {}) }, '', urlFor(step.path));
  } catch (e) {
    console.warn('[nav] history falhou:', e);
  }

  document.dispatchEvent(new CustomEvent('step:change', { detail: { stepKey } }));

  if (!opts.silent) track(step.path, step.ga4, opts.params);
}

/**
 * Sai de um grupo de etapas de volta para a página base (ex.: fechar o modal
 * → '/'). Empurra a URL base e dispara só o pageview do CS (sem evento GA4).
 */
export function goToBase(basePath: string, opts: { silent?: boolean; replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  if (basePath === lastPath) return;
  lastPath = basePath;
  try {
    history[opts.replace ? 'replaceState' : 'pushState']({ stepKey: null }, '', urlFor(basePath));
  } catch (e) {
    console.warn('[nav] history falhou:', e);
  }
  if (!opts.silent) track(basePath, null);
}

export function resolveStepFromPath(pathname: string): StepKey | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const hit = (Object.entries(STEPS) as [StepKey, { path: string }][]).find(([, s]) => s.path === clean);
  return hit ? hit[0] : null;
}

/**
 * Botão voltar do navegador/celular volta UMA etapa em vez de sair do site.
 * `render(stepKey, state)` recebe a etapa resolvida da URL (null = página
 * base, ex.: '/' com modal fechado) e o `history.state` gravado no goToStep.
 * Re-exibição conta como nova view (correto) — dispara CS + GA4 da etapa.
 * @param basePath path da página base do grupo (ex.: '/presente' ou '/')
 */
export function initStepHistory(
  render: (stepKey: StepKey | null, state: Record<string, unknown> | null) => void,
  basePath: string,
): void {
  if (typeof window === 'undefined') return;
  lastPath = location.pathname.replace(/\/+$/, '') || '/';
  window.addEventListener('popstate', (e: PopStateEvent) => {
    const st = (e.state && typeof e.state === 'object') ? (e.state as Record<string, unknown>) : null;
    const stepKey = (st?.stepKey as StepKey | null | undefined) ?? resolveStepFromPath(location.pathname);
    const path = location.pathname.replace(/\/+$/, '') || '/';
    lastPath = path;
    render(stepKey ?? null, st);
    // Se o render redirecionou (replace) para outro path, respeita o novo path.
    const now = location.pathname.replace(/\/+$/, '') || '/';
    if (now !== path) return;
    const step = stepKey ? STEPS[stepKey] : null;
    if (step) track(step.path, step.ga4);
    else if (path === basePath) track(basePath, null);
  });
}

// ---------------------------------------------------------------------------
// Ponte para o script `is:inline` do ModalVanilla.astro (não consegue import).
// ---------------------------------------------------------------------------
export function exposeStepNavigation(): void {
  if (typeof window === 'undefined') return;
  (window as any).__tcNav = { goToStep, goToBase, initStepHistory, resolveStepFromPath, track, STEPS };
}
