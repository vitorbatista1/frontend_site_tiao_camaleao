// ═══════════════════════════════════════════════════════════════════════════
// [ASSISTENTE 2026-07] Assistente Guiado Tião — funil conversacional mobile-first.
// Fluxo: nome → amostra (ou sob-encomenda) → oferta por criança → família →
// (downsell relâmpago) → dados de contato → handoff para /pagamento.
//
// COEXISTÊNCIA: reusa o checkout existente. Escreve o MESMO orderData do
// ModalVanilla no localStorage e redireciona para /pagamento — order bumps por
// criança (/api/albums/suggest-order-bumps), PIX, Bricks de cartão,
// AddPaymentInfo e o Purchase deduplicado da /confirmacao já funcionam sem
// duplicar código de pagamento.
//
// EVENTOS (browser + CAPI via lib/tracking.ts, mesmo event_id p/ dedup):
//   ViewContent → primeira reprodução da amostra
//   Lead        → contato capturado na tela de dados
//   InitiateCheckout → clique final "Fazer pagamento" (items reais)
//   AddPaymentInfo/Purchase → páginas /pagamento e /confirmacao existentes.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { trackBoth, getSessionId, normalizePhoneBR } from '../../lib/tracking';
import {
  type AlbumAPI, type AlbumResult, type Catalogo, type Crianca,
  montarCatalogo, num, displayName, temAlbum, nFalt, foundCount,
  precoAlbumBase, precoColecao, precoCrianca, precoRelampago,
  resumoCrianca, checkPromote, menorPreco,
} from './assistente.types';
import { Balao, BotaoPrimario, BotaoWhatsApp, LinkDiscreto, ReguaEntrega, SeloProva, PlayerAmostra, type MedleyCue } from './AssistentePecas';
import OfertaCards from './OfertaCards';

const API_URL = import.meta.env.PUBLIC_API_URL as string;
// Ex.: https://<bucket>.fsn1.your-objectstorage.com/medleys
// const MEDLEY_BASE = (import.meta.env.PUBLIC_MEDLEY_BASE as string | undefined)?.replace(/\/$/, '');
const MEDLEY_BASE = 'https://tiao.fsn1.your-objectstorage.com/medleys'
// Manifestos JSON: via API do backend (CORS já resolvido, credenciais no servidor).
// GET {API_URL}/api/medleys/medley_{ref}{sufixo}.json
const MEDLEY_MANIFEST_BASE = `${API_URL}/api/medleys`;
const WA_ATENDIMENTO = 'https://wa.me/message/EIW6E6DLZWLCF1';

type Tela = 'nome' | 'amostra' | 'fallback' | 'oferta' | 'familia' | 'addnome' | 'relampago' | 'dados';

// [ORDER-BUMP 2026-08] Mesmo shape retornado por /api/albums/suggest-order-bumps.
interface AlbumBumpAlbum {
  id: string; name: string; linkImgAlbum?: string;
  priceOld: number | string | null; priceNew: number | string;
  orderBumpDiscount: number | string; tipo?: string;
}
interface AlbumBumpSuggestion { childName: string; albums: AlbumBumpAlbum[] }

// [NOME-DIGITADO 2026-08] Exibição usa o nome como a pessoa escreveu (Arthur),
// capitalizado; a referência (Artur) segue interna: busca do medley no bucket,
// itens do pedido e entrega NÃO mudam.
const nomeDigitado = (c: Crianca) => {
  const t = (c.nome ?? '').trim();
  if (!t) return displayName(c);
  return t.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
};

const uuid = () => (crypto as any).randomUUID?.() ?? String(Date.now() + Math.random());

// MESMA normalização do gerador de medleys (medley_lib.norm + ref_de)
const refMedley = (nome: string) =>
  nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ').trim().replace(/ +/g, '_');

interface Medley { src: string; cues: MedleyCue[] }

// Busca o manifesto do medley: nome+sufixo → genérica (3 nomes) → null (usa linkAmostra)
async function buscarMedley(ref: string | null, sufixo: string | null): Promise<Medley | null> {
  if (!MEDLEY_BASE) return null; // sem base do bucket, degrada pro linkAmostra
  const tentativas = [
    ...(ref && sufixo ? [`medley_${ref}${sufixo}.json`] : []),
    'medley_generica123.json',
  ];
  for (const arq of tentativas) {
    try {
      const r = await fetch(`${MEDLEY_MANIFEST_BASE}/${arq}`); // JSON via API (proxy)
      if (!r.ok) continue;
      const m = await r.json();
      const src = /^https?:\/\//.test(m.file) ? m.file : `${MEDLEY_BASE}/${m.file}`;
      return { src, cues: m.cues as MedleyCue[] };
    } catch { /* tenta a próxima */ }
  }
  return null;
}
// [AJUSTES 2026-08] Seletor de DDI — Brasil padrão + países mais prováveis da base
// (clientes no exterior da pré-venda do Álbum 3) + "Outro" com DDI livre.
const DDIS: Array<[string, string]> = [
  ['55', '🇧🇷 +55'], ['1', '🇺🇸 +1'], ['351', '🇵🇹 +351'], ['81', '🇯🇵 +81'],
  ['44', '🇬🇧 +44'], ['34', '🇪🇸 +34'], ['49', '🇩🇪 +49'], ['33', '🇫🇷 +33'],
  ['39', '🇮🇹 +39'], ['41', '🇨🇭 +41'], ['61', '🇦🇺 +61'], ['outro', '🌍 Outro'],
];

// [AJUSTES 2026-08] Máscara progressiva (00) 00000-0000 — só quando DDI = 55.
const maskTelBR = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const novaCrianca = (nome: string): Crianca => ({
  id: uuid(), nome, albumResult: null, buscando: true,
  sel: [], colecao: false, autoPromo: false, selAntes: null, relampago: false,
});
const fmtBRL = (v: number) => `R$ ${Math.round(v) === v ? v : v.toFixed(2).replace('.', ',')}`;

export default function AssistenteGuiado() {
  const [tela, setTela] = useState<Tela>('nome');
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [criancas, setCriancas] = useState<Crianca[]>([]);
  const [ativa, setAtiva] = useState(0);
  const [nomeInput, setNomeInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [listaAberta, setListaAberta] = useState<string | null>(null);
  const [contato, setContato] = useState({ fullName: '', email: '', telefone: '' });
  const [ddi, setDdi] = useState('55');            // [AJUSTES 2026-08] DDI selecionado ('outro' = campo livre)
  const [ddiOutro, setDdiOutro] = useState('');    // [AJUSTES 2026-08] DDI digitado quando 'Outro'
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null); // [AJUSTES 2026-08] id da criança aguardando confirmação de remoção
  const [erroContato, setErroContato] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [medley, setMedley] = useState<Medley | null>(null);
  // [ORDER-BUMP 2026-08] Sugestões por álbum (mesmo endpoint da campanha1,
  // escopado por campanha=CAMPANHA3) — oferecidas aqui, na tela de dados,
  // antes de seguir pro pagamento.
  const [albumBumps, setAlbumBumps] = useState<AlbumBumpSuggestion[]>([]);
  const [selectedBumpKeys, setSelectedBumpKeys] = useState<Set<string>>(new Set());
  const vcDisparado = useRef(false);

  // capa por álbum (posição 1..N do catálogo) — usada na troca durante o medley
  const capaPorAlbum = useMemo(() => {
    const m: Record<number, string | undefined> = {};
    catalogo?.base.forEach((b, i) => { m[i + 1] = b.linkImgAlbum; });
    return m;
  }, [catalogo]);

  // resolve o medley quando entra na amostra/fallback
  useEffect(() => {
    if (tela !== 'amostra' && tela !== 'fallback') return;
    const cr = criancas[ativa];
    if (!catalogo) return;
    let sufixo: string | null = null, ref: string | null = null;
    if (tela === 'amostra' && cr?.albumResult?.found) {
      ref = refMedley(cr.albumResult.display_name || cr.nome);
      const pos = catalogo.base
        .map((b, i) => (cr.albumResult!.albums ?? []).includes(b.id) ? i + 1 : 0)
        .filter(Boolean);
      sufixo = pos.join('');
    }
    let ativo = true;
    buscarMedley(ref, sufixo).then((m) => { if (ativo) setMedley(m); });
    return () => { ativo = false; };
  }, [tela, ativa, catalogo]);

  // Catálogo real do DB — preços, capas (linkImgAlbum), amostras (linkAmostra), repertório.
  useEffect(() => {
    fetch(`${API_URL}/api/albums?campanha=CAMPANHA3`)
      .then((r) => r.json())
      .then((json) => {
        const lista: AlbumAPI[] = Array.isArray(json) ? json : (json.data ?? json.albums ?? []);
        setCatalogo(montarCatalogo(lista));
      })
      .catch(() => {});
  }, []);

  // [ORDER-BUMP 2026-08] Ao chegar na tela de dados, busca álbuns complementares
  // já disponíveis pro(s) nome(s) do pedido — mesmo endpoint/critério da campanha1
  // (oferece o que falta, checando disponibilidade por nome). Crianças em
  // "relâmpago" ou que já pegaram a Coleção não entram (nada falta pra sugerir).
  useEffect(() => {
    if (tela !== 'dados' || !catalogo) return;
    const cartItems = criancas
      .filter((x) => !x.relampago)
      .flatMap((x) => {
        const nome = displayName(x);
        if (x.colecao) return catalogo.base.map((b) => ({ albumId: b.id, childName: nome }));
        return x.sel.filter((id) => temAlbum(x, id)).map((id) => ({ albumId: id, childName: nome }));
      });
    if (cartItems.length === 0) { setAlbumBumps([]); return; }
    let ativo = true;
    fetch(`${API_URL}/api/albums/suggest-order-bumps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItems, campanha: 'CAMPANHA3' }),
    })
      .then((r) => r.json())
      .then((json) => { if (ativo && json.success) setAlbumBumps(json.data); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [tela, criancas, catalogo]);

  const bumpPrecoOferta = (a: AlbumBumpAlbum) => {
    const preco = num(a.priceNew);
    const desconto = num(a.orderBumpDiscount);
    return desconto > 0 ? Math.max(0, preco - desconto) : preco;
  };
  const bumpTotal = useMemo(
    () => albumBumps.reduce((acc, s) => acc + s.albums.reduce((a2, alb) =>
      selectedBumpKeys.has(`${s.childName}::${alb.id}`) ? a2 + bumpPrecoOferta(alb) : a2, 0), 0),
    [albumBumps, selectedBumpKeys],
  );
  const toggleBump = (key: string) => setSelectedBumpKeys((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const c = criancas[ativa] ?? criancas[0] ?? null;
  const irPara = (t: Tela) => { setListaAberta(null); setConfirmarRemocao(null); setTela(t); window.scrollTo(0, 0); };
  const atualizar = (fn: (draft: Crianca) => void) =>
    setCriancas((prev) => prev.map((x, i) => { if (i !== ativa) return x; const d = { ...x, sel: [...x.sel] }; fn(d); return d; }));

  // ── disponibilidade: /api/children/search (variações → nome referência → álbuns) ──
  async function buscarDisponibilidade(nome: string): Promise<AlbumResult> {
    try {
      const res = await fetch(`${API_URL}/api/children/search?name=${encodeURIComponent(nome.trim())}&campanha=CAMPANHA3`);
      if (res.status === 404) return { found: false };
      return (await res.json()) as AlbumResult;
    } catch { return { found: false }; }
  }

  async function submeterNome(primeira: boolean) {
    const nome = nomeInput.trim();
    if (nome.length < 2 || buscando) return;
    setBuscando(true);
    const nova = novaCrianca(nome);
    const resultado = await buscarDisponibilidade(nome);
    nova.albumResult = resultado; nova.buscando = false;
    setBuscando(false);
    if (!primeira && criancas.some((x) => displayName(x).toLowerCase() === (resultado.display_name ?? nome).toLowerCase())) {
      irPara('familia'); return;
    }
    setCriancas((prev) => primeira ? [nova] : [...prev, nova]);
    setAtiva(primeira ? 0 : criancas.length);
    setNomeInput('');
    irPara(resultado.found ? 'amostra' : 'fallback');
  }

  // ── ViewContent na primeira reprodução da amostra ──
  function onPrimeiraReproducao() {
    if (vcDisparado.current || !catalogo || !c) return;
    vcDisparado.current = true;
    const ids = catalogo.base.map((b) => b.id);
    trackBoth('ViewContent', {
      event_name: 'ViewContent',
      event_id: `VC_${getSessionId()}_${Date.now()}`,
      content_name: `Amostra - ${displayName(c)}`,
      content_ids: ids,
      contents: ids.map((id) => ({ id, quantity: 1 })),
      value: num(catalogo.combo?.priceNew),
    });
  }

  // ── seleção múltipla ──
  const toggleAlbum = (baseId: string) => atualizar((d) => {
    if (!catalogo) return;
    if (d.colecao) { d.colecao = false; d.autoPromo = false; d.sel = [baseId]; return; } // toque no cinza = "só este"
    const i = d.sel.indexOf(baseId);
    if (i >= 0) d.sel.splice(i, 1); else d.sel.push(baseId);
    checkPromote(d, catalogo);
  });
  const toggleColecao = () => atualizar((d) => {
    if (d.colecao) { d.colecao = false; d.autoPromo = false; d.sel = d.selAntes ? [...d.selAntes] : []; }
    else { d.selAntes = [...d.sel]; d.colecao = true; d.autoPromo = false; }
  });
  const desfazerPromo = () => atualizar((d) => { d.colecao = false; d.autoPromo = false; d.sel = d.selAntes ? [...d.selAntes] : []; });

  const totalPedido = useMemo(
    () => (catalogo ? criancas.reduce((acc, x) => acc + precoCrianca(x, catalogo), 0) : 0),
    [criancas, catalogo],
  );

  const totalFinal = totalPedido + bumpTotal;

  // ── handoff: mesmo orderData do ModalVanilla → /pagamento ──
  function fazerPagamento() {
    if (!catalogo || enviando) return;
    const email = contato.email.trim().toLowerCase();
    const tel = (contato.telefone || '').replace(/\D/g, '');
    // [AJUSTES 2026-08] Telefone com DDI: BR exige 10–11 dígitos; exterior 6–14
    // (comprimentos nacionais variam). telIntl ("+" + DDI + número) sinaliza ao
    // normalizePhoneBR que o DDI já está presente — sem prefixo 55 forçado.
    const ddiEfetivo = (ddi === 'outro' ? ddiOutro : ddi).replace(/\D/g, '');
    const telValido = ddiEfetivo === '55'
      ? tel.length >= 10 && tel.length <= 11
      : ddiEfetivo.length >= 1 && tel.length >= 6 && tel.length <= 14;
    if (!contato.fullName.trim() || !email.includes('@') || !telValido) {
      setErroContato(ddiEfetivo && ddiEfetivo !== '55' && !telValido && contato.fullName.trim() && email.includes('@')
        ? 'Confira o código do país (DDI) e o número do WhatsApp.'
        : 'Preencha seu nome, WhatsApp e e-mail para receber as cantigas.');
      return;
    }
    const telIntl = `+${ddiEfetivo}${tel}`;
    setEnviando(true);

    const gravacaoItems: Array<{ albumId: string; childName: string; name: string; price: number; misto?: boolean; isRelampago?: boolean; tipo?: string }> = [];
    const childrenClean = criancas.map((x) => {
      const nome = displayName(x);
      const cleanSel: string[] = [];
      if (x.relampago) {
        // A tela relâmpago só é oferecida quando a criança JÁ tem o Álbum 1
        // gravado (ver irPara(temAlbum(...) ? 'relampago' : 'nome')) — é uma
        // revenda com desconto, não uma gravação nova. tipo real evita que o
        // CAPI/n8n classifique como "gravacao" por engano.
        const a1 = catalogo.base[0];
        const jaGravado = a1 ? temAlbum(x, a1.id) : false;
        gravacaoItems.push({ albumId: a1?.id ?? 'album1', childName: nome, name: `${a1?.name ?? 'Álbum 1'} (Oferta Relâmpago)`, price: precoRelampago(catalogo), isRelampago: true, tipo: jaGravado ? 'ALBUM' : 'GRAVACAO' });
      } else if (x.colecao) {
        const faltantes = catalogo.base.filter((b) => !temAlbum(x, b.id));
        if (faltantes.length === 0 && catalogo.combo) {
          // coleção 100% pronta
          cleanSel.push(catalogo.combo.id);
        } else if (faltantes.length === catalogo.base.length && catalogo.comboGravacao) {
          // coleção 100% sob encomenda → produto único (precificado combo+taxa×N no admin)
          gravacaoItems.push({
            albumId: catalogo.comboGravacao.id, childName: nome,
            name: `${catalogo.comboGravacao.name} - GRAVACAO`,
            price: precoColecao(x, catalogo),
          });
        } else {
          // coleção MISTA → decomposição: Coleção (preço do DB) + taxa por faltante.
          // Garante a política +taxa/álbum sem depender de priceMistoNew (política antiga).
          if (catalogo.combo) cleanSel.push(catalogo.combo.id);
          for (const b of faltantes) {
            const t = catalogo.taxaPorBase[b.id];
            gravacaoItems.push({
              // [TAXA-SINTETICA 2026-08] Sem produto de taxa no banco, o ID é
              // sintético "taxa:{baseId}" — NUNCA o ID do álbum base. Com o ID
              // base, o backend (anti-manipulação) recalculava pro priceNew do
              // álbum (39/67) e o cliente via R$197 mas pagava R$203. O valor
              // real da taxa é a constante TAXA_GRAVACAO do servidor (R$50).
              albumId: t?.id ?? `taxa:${b.id}`, childName: nome,
              name: t?.name ?? `Taxa de Gravação - ${b.name}`,
              price: t ? num(t.priceNew) : catalogo.taxaPadrao,
            });
          }
        }
      } else {
        for (const baseId of x.sel) {
          if (temAlbum(x, baseId)) { cleanSel.push(baseId); continue; }
          const g = catalogo.gravacaoPorBase[baseId];
          gravacaoItems.push({
            albumId: g?.id ?? baseId, childName: nome,
            name: `${catalogo.porId[baseId]?.name ?? 'Álbum'} Gravação`,
            price: precoAlbumBase(x, baseId, catalogo),
          });
        }
      }
      return { id: x.id, name: x.nome, albumResult: x.albumResult, selectedAlbums: cleanSel };
    });

    // [ORDER-BUMP 2026-08] Mescla os álbuns-bônus aceitos na tela de dados —
    // já confirmadamente disponíveis pro nome (checado no fetch de sugestões).
    selectedBumpKeys.forEach((key) => {
      const [childName, albumId] = key.split('::');
      const alvo = childrenClean.find((ch) => (ch.albumResult?.display_name ?? ch.name) === childName);
      if (alvo && !alvo.selectedAlbums.includes(albumId)) alvo.selectedAlbums.push(albumId);
    });

    // InitiateCheckout — browser + CAPI, mesmo event_id (dedup no Meta).
    const icEventId = `IC_${Date.now()}`;
    const nameParts = contato.fullName.trim().split(/\s+/);
    const icItems = [
      ...childrenClean.flatMap((ch) => ch.selectedAlbums.map((id) => ({
        id, name: catalogo.porId[id]?.name ?? id, quantity: 1, price: num(catalogo.porId[id]?.priceNew),
      }))),
      ...gravacaoItems.map((g) => ({ id: g.albumId, name: g.name, quantity: 1, price: g.price })),
    ];
    trackBoth('InitiateCheckout', {
      event_name: 'InitiateCheckout',
      event_id: icEventId,
      value: totalFinal,
      num_items: icItems.length,
      content_ids: icItems.map((i) => i.id),
      contents: icItems.map((i) => ({ id: i.id, quantity: 1, item_price: i.price })),
      checkout: { currency: 'BRL', value: totalFinal, items: icItems },
      em: email, ph: telIntl, // [AJUSTES 2026-08] telefone já com DDI correto (matching CAPI)
      fn: nameParts[0] ?? null, ln: nameParts.slice(1).join(' ') || null,
      children: criancas.map((x) => ({ nome: displayName(x), resumo: resumoCrianca(x, catalogo) })),
    }, { email, phone: telIntl, fullName: contato.fullName });

    localStorage.setItem('orderData', JSON.stringify({
      // [AJUSTES 2026-08] telIntl preserva o DDI do exterior (entrega WhatsApp correta)
      customerData: { fullName: contato.fullName.trim(), email, telefone: normalizePhoneBR(telIntl) ?? tel },
      children: childrenClean,
      albumsAPI: Object.values(catalogo.porId),
      productName: 'Cantigas Personalizadas',
      total: totalFinal.toFixed(2),
      isCombo: criancas.some((x) => x.colecao),
      gravacaoItems,
      // [ORDER-BUMP 2026-08] Bump por álbum já resolvido aqui (mesmo mecanismo/
      // critério da campanha1 — /api/albums/suggest-order-bumps escopado por
      // campanha), então /pagamento não pergunta de novo: só recebe as
      // sugestões e a seleção pra aplicar o desconto certo no resumo/total.
      skipOrderBumps: true,
      albumBumpSuggestions: albumBumps,
      presenteSelectedBumps: Array.from(selectedBumpKeys),
      campanha: 'CAMPANHA3',
      sourcePath: '/presente',
      tracking: {
        fbp: (document.cookie.match(/(?:^| )_fbp=([^;]+)/) || [])[1] || null,
        fbc: (document.cookie.match(/(?:^| )_fbc=([^;]+)/) || [])[1] || null,
        user_agent: navigator.userAgent,
        event_source_url: location.href,
        referrer: document.referrer || null,
        session_id: getSessionId(),
      },
    }));
    window.location.href = '/pagamento';
  }

  function leadContato() {
    const email = contato.email.trim().toLowerCase();
    const tel = (contato.telefone || '').replace(/\D/g, '');
    // [AJUSTES 2026-08] mínimo relaxado p/ exterior (6 dígitos) — comprimentos variam por país
    const ddiEfetivo = (ddi === 'outro' ? ddiOutro : ddi).replace(/\D/g, '');
    const minTel = ddiEfetivo === '55' ? 10 : 6;
    if (!email.includes('@') && tel.length < minTel) return;
    const telIntl = tel.length >= minTel && ddiEfetivo ? `+${ddiEfetivo}${tel}` : null;
    trackBoth('Lead', {
      event_name: 'Lead', event_id: `Lead_${Date.now()}`, value: 1,
      lead: { name: contato.fullName || undefined, email: email || undefined, phone: telIntl ?? undefined },
    }, { email, phone: telIntl ?? undefined, fullName: contato.fullName });
  }

  if (!catalogo) {
    return <div className="py-16 text-center font-bold text-white">Carregando as cantigas… 🎵</div>;
  }

  // [AJUSTES 2026-08] Remoção confirmada de uma criança do pedido (tela família).
  // Última criança removida → volta ao início (não existe pedido vazio).
  function removerCrianca(id: string) {
    const restantes = criancas.filter((x) => x.id !== id);
    setConfirmarRemocao(null);
    setCriancas(restantes);
    setAtiva(0);
    if (restantes.length === 0) { setNomeInput(''); irPara('nome'); }
  }

  const anyGrav = criancas.some((x) => (x.colecao && nFalt(x, catalogo) > 0) || x.sel.some((id) => !temAlbum(x, id)));
  const allGrav = criancas.length > 0 && criancas.every((x) => foundCount(x) === 0);

  // ═══════════════ TELAS ═══════════════
  return (
    <div className="mx-auto w-full max-w-[430px] px-3.5 pb-24 pt-4 md:max-w-[480px]">
      {/* topo */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-white">
          <img src="/imagens/campanha2/icone_tiao.png" alt="Tião" className="h-full w-full object-contain" />
        </div>
        <div className="text-white">
          <b className="block font-display text-xl leading-tight">Tião Camaleão</b>
          <span className="text-[10.5px] font-extrabold tracking-wider opacity-90">CANTIGAS PERSONALIZADAS · DESDE 2013</span>
        </div>
      </div>

      {tela === 'nome' && (
        <>
          <Balao>Olá, aqui é o Tião Camaleão! Qual é o nome da criança?</Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            <p className="mb-3 text-center text-base font-bold">Vou tocar umas cantigas com o nome dela agora:</p>
            <input
              className="w-full rounded-2xl border-[2.5px] border-[#D8D9E8] px-4 py-4 text-center text-[19px] font-bold outline-none focus:border-[#12B3F2]"
              placeholder="Digite o nome da criança aqui"
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submeterNome(true)}
            />
            <div className="h-3.5" />
            <BotaoPrimario onClick={() => submeterNome(true)} disabled={buscando}>
              {buscando ? 'Procurando… 🎵' : '🎧 Ouvir agora!'}
            </BotaoPrimario>
          </div>
          <p className="mt-3 text-center text-[13.5px] font-bold text-white/90">
            Mais de 2000 nomes gravados · Álbuns a partir de {fmtBRL(num(catalogo.base[0]?.priceNew))}
          </p>
        </>
      )}

      {tela === 'amostra' && c && (
        <>
          <Balao>Aqui está a amostra de {nomeDigitado(c)}! Aperte o play para ouvir</Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            <PlayerAmostra
              src={medley?.src ?? catalogo.base[0]?.linkAmostra}
              srcFallback={catalogo.base[0]?.linkAmostra}
              cues={medley?.cues}
              capaPorAlbum={capaPorAlbum}
              capa={catalogo.base[0]?.linkImgAlbum}
              cantiga="Ciranda Cirandinha"
              nome={nomeDigitado(c)}
              onFirstPlay={onPrimeiraReproducao}
            />
            <div className="h-3" />
            <BotaoPrimario onClick={() => irPara('oferta')}>Conhecer as cantigas para {displayName(c)} →</BotaoPrimario>
            <LinkDiscreto onClick={() => { setCriancas([]); setNomeInput(''); irPara('nome'); }}>← Trocar o nome</LinkDiscreto>
          </div>
        </>
      )}

      {tela === 'fallback' && c && (
        <>
          <Balao>Poxa, ainda não temos o nome <b>{displayName(c)}</b> gravado no nosso acervo.</Balao>
          <Balao>
            Mas a notícia boa é que podemos gravar especialmente para você. Fazemos a gravação sob encomenda em
            estúdio profissional, e você recebe em até 7 dias.
          </Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            <div className="my-2.5 rounded-[14px] bg-[#F7F8FC] px-3.5 py-3 text-[15px] font-bold leading-snug">
              Ouça aqui uma amostra com outro nome para você conhecer o nosso trabalho
            </div>
            <PlayerAmostra
              src={medley?.src ?? catalogo.base[0]?.linkAmostra}
              srcFallback={catalogo.base[0]?.linkAmostra}
              cues={medley?.cues}
              capaPorAlbum={capaPorAlbum}
              capa={catalogo.base[0]?.linkImgAlbum}
              cantiga="Ciranda Cirandinha"
              subtitulo="exemplos reais, gravados no nosso estúdio"
            />
            <BotaoPrimario onClick={() => irPara('oferta')}>Escolher os álbuns de {displayName(c)} →</BotaoPrimario>
            <BotaoWhatsApp onClick={() => window.open(WA_ATENDIMENTO, '_blank')}>Prefiro pedir pelo WhatsApp</BotaoWhatsApp>
            <LinkDiscreto onClick={() => { setCriancas([]); setNomeInput(''); irPara('nome'); }}>← Tentar outro nome</LinkDiscreto>
          </div>
        </>
      )}

      {tela === 'oferta' && c && (
        <>
          <Balao>
            Vamos lá! Escolha os álbuns com as cantigas personalizadas para <b>{displayName(c)}</b>
            <br /><span className="text-[15px]">São 4 opções, <b className="text-[#3FA744]">a partir de {fmtBRL(menorPreco(c, catalogo))}</b> — role para ver todas.</span>
            {foundCount(c) === 0 && <><br /><span className="text-[15px]">A taxa de gravação de estúdio <b className="text-[#3FA744]">já está incluída nos valores</b>.</span></>}
            {foundCount(c) > 0 && nFalt(c, catalogo) > 0 && (
              <><br /><span className="text-[15px]">
                O nome já está gravado em: <b>{catalogo.base.filter((b) => temAlbum(c, b.id)).map((b) => b.name).join(' e ')}</b>.{' '}
                Os demais a gente grava sob encomenda (<b className="text-[#3FA744]">valor já incluído no preço</b>).
              </span></>
            )}
          </Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            <OfertaCards
              crianca={c} catalogo={catalogo}
              listaAberta={listaAberta} setListaAberta={setListaAberta}
              onToggleColecao={toggleColecao} onToggleAlbum={toggleAlbum} onDesfazerPromo={desfazerPromo}
            />
                        <ReguaEntrega anyGrav={nFalt(c, catalogo) > 0 && foundCount(c) > 0} allGrav={foundCount(c) === 0} />
            <SeloProva />
            <div className="h-3.5" />
            <BotaoPrimario disabled={!c.colecao && c.sel.length === 0} onClick={() => irPara('familia')}>
              {c.colecao
                ? `Quero a Coleção Completa · ${fmtBRL(precoCrianca(c, catalogo))}`
                : c.sel.length === 0
                  ? 'Escolha uma opção acima'
                  : c.sel.length === 1
                    ? `Quero o ${catalogo.porId[c.sel[0]]?.name} · ${fmtBRL(precoCrianca(c, catalogo))}`
                    : `Quero os ${c.sel.length} álbuns · ${fmtBRL(precoCrianca(c, catalogo))}`}
            </BotaoPrimario>
            <BotaoWhatsApp onClick={() => window.open(`${WA_ATENDIMENTO}?text=${encodeURIComponent('Vi um album no seu site e tenho duvidas')}`, '_blank')}>
              Prefiro comprar com o vendedor
            </BotaoWhatsApp>
            {ativa === 0
              ? <LinkDiscreto onClick={() => irPara(temAlbum(c, catalogo.base[0]?.id ?? '') ? 'relampago' : 'nome')}>Agora não</LinkDiscreto>
              : <LinkDiscreto onClick={() => { setCriancas((p) => p.filter((_, i) => i !== ativa)); setAtiva(0); irPara('familia'); }}>← Voltar sem adicionar {displayName(c)}</LinkDiscreto>}
          </div>
        </>
      )}

      {tela === 'familia' && (
        <>
          <Balao>Legal, anotei seu pedido! Deseja adicionar outra criança?</Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            {/* [AJUSTES 2026-08] Balões viram linhas com "×" de remover. O × NUNCA remove
                direto: abre a confirmação abaixo (protege toque acidental e explica a ação). */}
            <div className="mb-3.5 flex flex-col gap-2">
              {criancas.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-[#BEE4F7] bg-[#EAF6FD] px-3 py-2 text-[14.5px] font-extrabold text-[#0A8FC7]">
                  <span>🎵 {displayName(x)} · {resumoCrianca(x, catalogo)} · {fmtBRL(precoCrianca(x, catalogo))}</span>
                  <button
                    onClick={() => setConfirmarRemocao(x.id)}
                    aria-label={`Remover ${displayName(x)} do pedido`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#9AD1EE] bg-white text-[#0A8FC7]"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {confirmarRemocao && (() => {
              const alvo = criancas.find((x) => x.id === confirmarRemocao);
              if (!alvo) return null;
              return (
                <div className="mb-3.5 rounded-[14px] border-2 border-dashed border-[#F2A183] bg-[#FDF1EB] px-3.5 py-3">
                  <p className="mb-2.5 text-[15px] font-extrabold text-[#9A3F1C]">Remover o pedido de {displayName(alvo)}?</p>
                  <div className="flex gap-2">
                    <button onClick={() => removerCrianca(alvo.id)} className="flex-1 rounded-xl bg-[#E0653A] px-3 py-2.5 font-display text-[15px] font-bold text-white shadow-[0_3px_0_#B54A24] active:translate-y-0.5">
                      Sim, remover
                    </button>
                    <button onClick={() => setConfirmarRemocao(null)} className="flex-1 rounded-xl border-2 border-[#D8D9E8] bg-white px-3 py-2.5 font-display text-[15px] font-bold text-[#2B2B4E]">
                      Não, manter
                    </button>
                  </div>
                </div>
              );
            })()}
            <BotaoPrimario onClick={() => irPara('dados')}>Fazer pagamento →</BotaoPrimario>
            <button onClick={() => { setNomeInput(''); irPara('addnome'); }} className="mt-2.5 block w-full rounded-2xl border-[2.5px] border-[#D8D9E8] bg-white px-4 py-3.5 font-display text-[17px] font-bold text-[#0A8FC7]">
              + Adicionar outra criança
            </button>
          </div>
        </>
      )}

      {tela === 'addnome' && (
        <>
          <Balao>Que ótimo! Me diga agora o nome da outra criança:</Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            <input
              className="w-full rounded-2xl border-[2.5px] border-[#D8D9E8] px-4 py-4 text-center text-[19px] font-bold outline-none focus:border-[#12B3F2]"
              placeholder="Digite o nome da criança aqui"
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submeterNome(false)}
            />
            <div className="h-3.5" />
            <BotaoPrimario onClick={() => submeterNome(false)} disabled={buscando}>{buscando ? 'Procurando… 🎵' : 'Continuar →'}</BotaoPrimario>
            <LinkDiscreto onClick={() => irPara('familia')}>← Voltar</LinkDiscreto>
          </div>
        </>
      )}

      {tela === 'relampago' && c && (
        <>
          <Balao>Espera! 🎁 Só nesta visita, eu tenho um presente pra você…</Balao>
          <div className="rounded-[22px] border-[3px] border-[#F2762E] bg-white p-5 shadow-lg text-center">
            <span className="rounded-[10px] bg-[#F2762E] px-2.5 py-1 text-[12px] font-extrabold text-white">⚡ OFERTA RELÂMPAGO</span>
            {catalogo.base[0]?.linkImgAlbum && (
              <img src={catalogo.base[0].linkImgAlbum} alt="" className="mx-auto mt-2.5 h-[84px] w-[84px] rounded-xl object-cover shadow" />
            )}
            <h2 className="mt-2 font-display text-[22px] font-bold leading-tight">
              {catalogo.base[0]?.name} completo<br />com o nome de {displayName(c)}
            </h2>
            <p className="mt-1.5 text-[15px] font-bold text-[#55556F]">7 cantigas personalizadas com o nome · entrega na hora</p>
            <div className="mt-3">
              <span className="text-base font-bold text-[#8A8AA3] line-through">{fmtBRL(num(catalogo.base[0]?.priceNew))}</span>
              <span className="ml-2 font-display text-[40px] font-extrabold text-[#F2762E]">{fmtBRL(precoRelampago(catalogo))}</span>
            </div>
            <div className="mt-2.5 rounded-xl border-2 border-[#F6C3CD] bg-[#FDECEF] px-3 py-2 text-[13.5px] font-extrabold text-[#B4233C]">⏰ vale só nesta visita</div>
            <div className="h-3.5" />
            <button
              onClick={() => { atualizar((d) => { d.relampago = true; d.colecao = false; d.sel = []; }); irPara('dados'); }}
              className="block w-full rounded-2xl bg-[#F2762E] px-4 py-4 font-display text-[19px] font-bold text-white shadow-[0_5px_0_#C4551B] active:translate-y-[3px]"
            >
              Quero o {catalogo.base[0]?.name} · {fmtBRL(precoRelampago(catalogo))}
            </button>
            <LinkDiscreto onClick={() => { setCriancas([]); irPara('nome'); }}>Não, obrigado</LinkDiscreto>
          </div>
        </>
      )}

      {tela === 'dados' && (
        <>
          <Balao>Quase lá! Informe seu nome, WhatsApp e e-mail — é por lá que enviamos as cantigas.</Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            <div className="rounded-[14px] bg-[#F7F8FC] px-3.5 py-3">
              {criancas.map((x) => (
                <div key={x.id} className="flex justify-between gap-2 border-b border-dashed border-[#D8D9E8] py-1.5 text-[15px] font-bold last:border-0">
                  <span>🎵 {displayName(x)} · {resumoCrianca(x, catalogo)}</span>
                  <span className="whitespace-nowrap font-extrabold">{fmtBRL(precoCrianca(x, catalogo))}</span>
                </div>
              ))}
              {albumBumps.flatMap((s) => s.albums.map((a) => {
                const key = `${s.childName}::${a.id}`;
                if (!selectedBumpKeys.has(key)) return null;
                return (
                  <div key={key} className="flex justify-between gap-2 border-b border-dashed border-[#D8D9E8] py-1.5 text-[15px] font-bold last:border-0">
                    <span>🎁 {a.name} · {s.childName}</span>
                    <span className="whitespace-nowrap font-extrabold">+ {fmtBRL(bumpPrecoOferta(a))}</span>
                  </div>
                );
              }))}
              <div className="flex justify-between pt-2 font-display text-[19px] font-bold">
                <span>Total</span><span className="text-[22px] text-[#3FA744]">{fmtBRL(totalFinal)}</span>
              </div>
            </div>

            {/* [ORDER-BUMP 2026-08] Álbuns complementares já disponíveis pro(s)
                nome(s) do pedido — mesmo mecanismo/critério da campanha1. */}
            {albumBumps.length > 0 && (
              <div className="mt-3.5 space-y-3">
                <p className="text-center text-[13.5px] font-extrabold text-[#B4531A]">🎁 Complete o pedido com esses álbuns</p>
                {albumBumps.map((s) => s.albums.map((a) => {
                  const key = `${s.childName}::${a.id}`;
                  const on = selectedBumpKeys.has(key);
                  return (
                    <div key={key}
                      onClick={() => toggleBump(key)}
                      className={`flex cursor-pointer items-center gap-3 rounded-[18px] border-[3px] border-dashed p-3.5 ${on ? 'border-[#3FA744] bg-[#EDF7EE]' : 'border-[#F2762E] bg-[#FFF6EF]'}`}
                    >
                      <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border-[3px] text-[19px] font-black text-white ${on ? 'border-[#3FA744] bg-[#3FA744]' : 'border-[#F2762E] bg-white'}`}>
                        {on ? '✓' : ''}
                      </div>
                      {a.linkImgAlbum && (
                        <img src={a.linkImgAlbum} alt="" loading="lazy" className="h-[46px] w-[46px] shrink-0 rounded-[10px] object-cover shadow" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-display text-[15.5px] font-bold leading-tight text-[#2B2B4E]">
                          {a.name} <span className="font-normal text-[#8A8AA3]">· {s.childName}</span>
                        </h4>
                        <div className="mt-0.5 flex items-baseline gap-1.5">
                          {num(a.orderBumpDiscount) > 0 && (
                            <span className="text-[12.5px] font-bold text-[#8A8AA3] line-through">{fmtBRL(num(a.priceNew))}</span>
                          )}
                          <span className="font-display text-[17px] font-extrabold text-[#3FA744]">{fmtBRL(bumpPrecoOferta(a))}</span>
                        </div>
                      </div>
                    </div>
                  );
                }))}
              </div>
            )}
            <label className="mt-3 block text-[14px] font-extrabold text-[#8A8AA3]">Seu nome</label>
            <input className="mt-1.5 w-full rounded-2xl border-[2.5px] border-[#D8D9E8] px-4 py-3.5 text-[17px] font-bold outline-none focus:border-[#12B3F2]"
              placeholder="Nome completo" autoComplete="name"
              value={contato.fullName} onChange={(e) => setContato({ ...contato, fullName: e.target.value })} />
            <label className="mt-3 block text-[14px] font-extrabold text-[#8A8AA3]">Seu WhatsApp</label>
            {/* [AJUSTES 2026-08] Seletor de DDI (🇧🇷 +55 padrão) + máscara BR condicional.
                Exterior: sem máscara, número nacional livre — o DDI vai junto no pedido. */}
            <div className="mt-1.5 flex gap-2">
              <select
                value={ddi}
                aria-label="Código do país (DDI)"
                onChange={(e) => {
                  const novo = e.target.value;
                  setDdi(novo);
                  const digitos = contato.telefone.replace(/\D/g, '');
                  setContato({ ...contato, telefone: novo === '55' ? maskTelBR(digitos) : digitos });
                }}
                className="shrink-0 rounded-2xl border-[2.5px] border-[#D8D9E8] bg-white px-2.5 py-3.5 text-[15px] font-bold text-[#2B2B4E] outline-none focus:border-[#12B3F2]"
              >
                {DDIS.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
              </select>
              {ddi === 'outro' && (
                <input
                  className="w-[74px] shrink-0 rounded-2xl border-[2.5px] border-[#D8D9E8] px-2 py-3.5 text-center text-[16px] font-bold outline-none focus:border-[#12B3F2]"
                  placeholder="+DDI" inputMode="numeric" aria-label="DDI do país"
                  value={ddiOutro}
                  onChange={(e) => setDdiOutro(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                />
              )}
              <input
                className="w-full min-w-0 rounded-2xl border-[2.5px] border-[#D8D9E8] px-4 py-3.5 text-[17px] font-bold outline-none focus:border-[#12B3F2]"
                placeholder={ddi === '55' ? '(00) 00000-0000' : 'Número com código de área'}
                inputMode="tel" autoComplete="tel"
                value={contato.telefone}
                onChange={(e) => setContato({
                  ...contato,
                  telefone: ddi === '55' ? maskTelBR(e.target.value) : e.target.value.replace(/[^\d ]/g, '').slice(0, 17),
                })}
              />
            </div>
            {ddi !== '55' && (
              <p className="mt-1.5 text-[12.5px] font-bold text-[#8A8AA3]">Digite o número sem o código do país — a gente junta o DDI pra você.</p>
            )}
            <label className="mt-3 block text-[14px] font-extrabold text-[#8A8AA3]">Seu e-mail</label>
            <input className="mt-1.5 w-full rounded-2xl border-[2.5px] border-[#D8D9E8] px-4 py-3.5 text-[17px] font-bold outline-none focus:border-[#12B3F2]"
              placeholder="nome@email.com" inputMode="email" autoComplete="email"
              value={contato.email} onChange={(e) => setContato({ ...contato, email: e.target.value })} onBlur={leadContato} />
            {erroContato && <p className="mt-2 text-[14px] font-bold text-[#E0455C]">{erroContato}</p>}
            <ReguaEntrega anyGrav={anyGrav} allGrav={allGrav} />
            <div className="h-4" />
            <BotaoPrimario onClick={fazerPagamento} disabled={enviando}>
              {enviando ? 'Preparando…' : `Ir para o pagamento · ${fmtBRL(totalFinal)}`}
            </BotaoPrimario>
            <div className="mt-3 text-center text-[13px] font-bold text-[#8A8AA3]">🔒 Pagamento seguro · Mercado Pago</div>
            <LinkDiscreto onClick={() => irPara(criancas[0]?.relampago ? 'relampago' : 'familia')}>← Voltar</LinkDiscreto>
          </div>
        </>
      )}

      {/* WhatsApp flutuante — atendimento */}
      <button
        onClick={() => window.open(WA_ATENDIMENTO, '_blank')}
        aria-label="Falar no WhatsApp"
        className="fixed bottom-4 right-3.5 z-40 h-14 w-14 rounded-full bg-white p-1.5 shadow-xl"
      >
        <img src="/icons/WhatsApp.png" alt="WhatsApp" className="h-full w-full" />
      </button>
    </div>
  );
}
