// ═══════════════════════════════════════════════════════════════════════════
// [ASSISTENTE 2026-07] Tipos e regras de negócio do Assistente Guiado.
// Preços SEMPRE derivados do /api/albums (DB) — nada hardcoded. O backend
// recalcula tudo em resolveItemPrices, então aqui é só exibição/UX.
// ═══════════════════════════════════════════════════════════════════════════

export interface AlbumAPI {
  id: string;
  name: string;
  tipo: 'ALBUM' | 'COMBO' | 'GRAVACAO';
  priceOld?: string | number | null;
  priceNew: string | number;
  priceMistoOld?: string | number | null;
  priceMistoNew?: string | number | null;
  linkAmostra?: string;
  linkImgAlbum?: string;
  repertorio?: unknown;
  campanha?: string;
  relatedAlbumId?: string | null;
  createdAt?: string;
}

export interface AlbumResult {
  found: boolean;
  display_name?: string;
  input_matched?: string;
  variations?: string[];
  albums?: string[]; // ids dos álbuns (tipo ALBUM) em que o nome existe
  message?: string;
}

export interface Crianca {
  id: string;              // uuid local
  nome: string;            // como digitado
  albumResult: AlbumResult | null;
  buscando: boolean;
  sel: string[];           // ids de álbuns BASE selecionados (a1/a2/a3 reais do DB)
  colecao: boolean;
  autoPromo: boolean;
  selAntes: string[] | null;
  somaAntes?: number;
  relampago: boolean;
}

export interface Catalogo {
  base: AlbumAPI[];                          // tipo ALBUM, ordenados (posição 1..N)
  combo: AlbumAPI | null;                    // Coleção Completa (tipo COMBO)
  comboGravacao: AlbumAPI | null;            // coleção 100% sob encomenda (GRAVACAO c/ "combo")
  gravacaoPorBase: Record<string, AlbumAPI>; // baseId → row "Álbum X Gravação" (produto completo)
  taxaPorBase: Record<string, AlbumAPI>;     // baseId → row "Taxa de Gravação" (só a taxa, p/ coleção mista)
  taxaPadrao: number;                        // valor da taxa por álbum (DB; fallback TAXA_GRAVACAO_FALLBACK)
  porId: Record<string, AlbumAPI>;
}

// Política de preços do assistente: produto gravado + R$50 de estúdio por
// álbum que precisar gravar. O valor vem do DB (produtos "Taxa de Gravação");
// este fallback só cobre o período antes do cadastro.
export const TAXA_GRAVACAO_FALLBACK = 50;

export const num = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : parseFloat(v);

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const posicaoNoNome = (name: string): number => {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 99;
};

// Monta o catálogo a partir do /api/albums — espelha payload.processor/checkout:
// base = tipo ALBUM ordenado por posição; gravações casadas por relatedAlbumId
// (fallback: número no nome); combo gravação = GRAVACAO com "combo" no nome.
export function montarCatalogo(albums: AlbumAPI[]): Catalogo {
  const base = albums
    .filter((a) => a.tipo === 'ALBUM')
    .sort((a, b) => posicaoNoNome(a.name) - posicaoNoNome(b.name));

  // Dois COMBOs coexistem no DB (Combo 1+2 da LP e a Coleção Completa nova):
  // prioriza "coleção/completa". O Combo 1+2 NÃO é usado no assistente
  // (decisão: sem desconto automático — quem marca A1+A2 paga a soma, e o
  // bump de +complemento entrega a Coleção; um bump por criança).
  const combo =
    albums.find((a) => a.tipo === 'COMBO' && /cole[cç][aã]o|completa/i.test(normalizar(a.name))) ??
    albums.find((a) => a.tipo === 'COMBO' && /\bcombo\b/i.test(normalizar(a.name))) ??
    albums.find((a) => a.tipo === 'COMBO') ?? null;

  // Mesma regra para a versão sob encomenda


  const comboGravacao =
    albums.find((a) => a.tipo === 'GRAVACAO' && /cole[cç][aã]o|completa/i.test(normalizar(a.name)) && !/taxa/i.test(normalizar(a.name))) ??
    albums.find((a) => a.tipo === 'GRAVACAO' && /\bcombo\b/i.test(normalizar(a.name)) && !/taxa/i.test(normalizar(a.name))) ?? null;

  const ehTaxa = (a: AlbumAPI) => /taxa/i.test(normalizar(a.name));
  const gravacoes = albums.filter((a) => a.tipo === 'GRAVACAO' && a !== comboGravacao && !ehTaxa(a));
  const taxas = albums.filter((a) => a.tipo === 'GRAVACAO' && ehTaxa(a));

  const gravacaoPorBase: Record<string, AlbumAPI> = {};
  const taxaPorBase: Record<string, AlbumAPI> = {};
  for (const b of base) {
    const g = gravacoes.find((x) => x.relatedAlbumId === b.id)
      ?? gravacoes.find((x) => posicaoNoNome(x.name) === posicaoNoNome(b.name));
    if (g) gravacaoPorBase[b.id] = g;
    const t = taxas.find((x) => x.relatedAlbumId === b.id)
      ?? taxas.find((x) => posicaoNoNome(x.name) === posicaoNoNome(b.name));
    if (t) taxaPorBase[b.id] = t;
  }
  const taxaPadrao = taxas.length ? num(taxas[0].priceNew) : TAXA_GRAVACAO_FALLBACK;

  const porId: Record<string, AlbumAPI> = {};
  for (const a of albums) porId[a.id] = a;

  return { base, combo, comboGravacao, gravacaoPorBase, taxaPorBase, taxaPadrao, porId };
}

// ── disponibilidade ────────────────────────────────────────────────────────
export const displayName = (c: Crianca) => c.albumResult?.display_name || c.nome;

export const temAlbum = (c: Crianca, baseId: string) =>
  !!c.albumResult?.found && (c.albumResult.albums ?? []).includes(baseId);

export const foundCount = (c: Crianca) =>
  c.albumResult?.found ? (c.albumResult.albums ?? []).length : 0;

// Elegibilidade do combo "misto" (Combo - Gravação Exclusiva com desconto):
// EXATAMENTE UM dos dois álbuns do combo (Álbum 1 ou Álbum 2 — cat.base[0]/[1])
// já gravado e o outro não. O Álbum 3 é um produto totalmente separado do
// combo 1+2 e nunca entra nessa conta.
export const mistoElegivel = (c: Crianca, cat: Catalogo): boolean => {
  const a1 = cat.base[0];
  const a2 = cat.base[1];
  if (!a1 || !a2) return false;
  return temAlbum(c, a1.id) !== temAlbum(c, a2.id);
};

export const nFalt = (c: Crianca, cat: Catalogo) =>
  cat.base.filter((b) => !temAlbum(c, b.id)).length;

// ── preços (exibição; backend revalida) ────────────────────────────────────
export function precoAlbumBase(c: Crianca, baseId: string, cat: Catalogo): number {
  const basePreco = num(cat.porId[baseId]?.priceNew);
  if (temAlbum(c, baseId)) return basePreco;
  // Política +taxa/álbum: usa a row "Álbum X Gravação" (que deve estar
  // precificada como base+taxa no admin); fallback = base + taxa.
  const g = cat.gravacaoPorBase[baseId];
  return g ? num(g.priceNew) : basePreco + cat.taxaPadrao;
}

// Coleção sob a política +taxa/álbum:
//   0 faltantes  → COMBO (preço cheio da coleção pronta)
//   N faltantes  → coleção + taxa × N
// A row comboGravacao (100% sob encomenda) tem prioridade quando TODOS faltam
// (deve estar precificada como coleção + taxa×3 no admin). priceMistoNew NÃO é
// usado: era a política antiga (150/120) — ver README.
export function precoColecao(c: Crianca, cat: Catalogo): number {
  const faltantes = nFalt(c, cat);
  const precoCombo = num(cat.combo?.priceNew);
  if (faltantes === 0) return precoCombo;
  if (faltantes === cat.base.length && cat.comboGravacao) return num(cat.comboGravacao.priceNew);
  return precoCombo + cat.taxaPadrao * faltantes;
}

export function deColecao(c: Crianca, cat: Catalogo): number {
  return cat.base.reduce((acc, b) => acc + precoAlbumBase(c, b.id, cat), 0);
}

export function precoCrianca(c: Crianca, cat: Catalogo): number {
  if (c.relampago) return precoRelampago(cat);
  if (c.colecao) return precoColecao(c, cat);
  return c.sel.reduce((acc, id) => acc + precoAlbumBase(c, id, cat), 0);
}

// ⚡ Oferta relâmpago (downsell): Álbum 1 com preço promocional.
// Se existir no admin um álbum isOrderBump/"relâmpago", usar o priceNew dele;
// senão, metade do Álbum 1 arredondada pra baixo em unidade (39 → 19).
export function precoRelampago(cat: Catalogo): number {
  const promo = (Object.values(cat.porId) as AlbumAPI[]).find((a) => /rel[âa]mpago/i.test(a.name));
  if (promo) return num(promo.priceNew);
  const a1 = cat.base[0];
  return a1 ? Math.max(1, Math.floor(num(a1.priceNew) / 2) - 0) - 0 : 19;
}

// ── nomenclatura (regra: "Nome - Álbum X - Gravação") ─────────────────────
export function labelAlbum(c: Crianca, baseId: string, cat: Catalogo): string {
  const b = cat.porId[baseId];
  const grava = !temAlbum(c, baseId);
  return `${displayName(c)} - ${b?.name ?? 'Álbum'}${grava ? ' - Gravação' : ''}`;
}
export function labelColecao(c: Crianca, cat: Catalogo): string {
  return `${displayName(c)} - ${cat.combo?.name ?? 'Coleção Completa'}${nFalt(c, cat) > 0 ? ' - Gravação' : ''}`;
}
export function resumoCrianca(c: Crianca, cat: Catalogo): string {
  if (c.relampago) return `${cat.base[0]?.name ?? 'Álbum 1'} (relâmpago)`;
  if (c.colecao) return `${cat.combo?.name ?? 'Coleção Completa'}${nFalt(c, cat) > 0 ? ' - Gravação' : ''}`;
  const nomes = c.sel.map((id) => cat.porId[id]?.name ?? id);
  const grava = c.sel.some((id) => !temAlbum(c, id));
  return nomes.join(' e ') + (grava ? ' (c/ gravação)' : '');
}

// Álbuns que faltam pra criança fechar a Coleção (texto do bump)
export function faltantesTxt(c: Crianca, cat: Catalogo): string {
  const tem = c.relampago ? [cat.base[0]?.id] : c.sel;
  return cat.base
    .filter((b) => !tem.includes(b.id))
    .map((b) => b.name + (temAlbum(c, b.id) ? '' : ' (gravação)'))
    .join(' e ');
}

// Menor preço disponível para a criança (usado no "a partir de R$ X" do topo
// da oferta) — considera gravação sob encomenda e preços futuros do DB.
export function menorPreco(c: Crianca, cat: Catalogo): number {
  const opcoes = [...cat.base.map((b) => precoAlbumBase(c, b.id, cat)), precoColecao(c, cat)];
  return Math.min(...opcoes.filter((v) => v > 0));
}

// ── seleção múltipla / promoção automática ────────────────────────────────
export function checkPromote(c: Crianca, cat: Catalogo): void {
  if (c.sel.length === 0) return;
  const soma = c.sel.reduce((acc, id) => acc + precoAlbumBase(c, id, cat), 0);
  const pc = precoColecao(c, cat);
  if (c.sel.length === cat.base.length || soma >= pc) {
    c.selAntes = [...c.sel];
    c.somaAntes = soma;
    c.colecao = true;
    c.autoPromo = true;
  }
}
