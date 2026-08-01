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
  resumoCrianca, checkPromote, menorPreco, faltantesTxt,
} from './assistente.types';
import { Balao, BotaoPrimario, BotaoWhatsApp, LinkDiscreto, ReguaEntrega, SeloProva, PlayerAmostra, type MedleyCue } from './AssistentePecas';
import OfertaCards from './OfertaCards';

const API_URL = import.meta.env.PUBLIC_API_URL as string;
// MP3s: direto da URL pública do bucket (tag <audio> não exige CORS).
// Ex.: https://<bucket>.fsn1.your-objectstorage.com/medleys
const MEDLEY_BASE = (import.meta.env.PUBLIC_MEDLEY_BASE as string | undefined)?.replace(/\/$/, '');
// Manifestos JSON: via API do backend (CORS já resolvido, credenciais no servidor).
// GET {API_URL}/api/medleys/medley_{ref}{sufixo}.json
const MEDLEY_MANIFEST_BASE = `${API_URL}/api/medleys`;
const WA_ATENDIMENTO = 'https://wa.me/message/EIW6E6DLZWLCF1';

type Tela = 'nome' | 'amostra' | 'fallback' | 'oferta' | 'familia' | 'addnome' | 'relampago' | 'dados';

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
      return { src: m.file, cues: m.cues as MedleyCue[] };
    } catch { /* tenta a próxima */ }
  }
  return null;
}
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
  const [erroContato, setErroContato] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [medley, setMedley] = useState<Medley | null>(null);
  const [bumpsSel, setBumpsSel] = useState<Record<string, boolean>>({});
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

  const c = criancas[ativa] ?? criancas[0] ?? null;
  const irPara = (t: Tela) => { setListaAberta(null); setTela(t); window.scrollTo(0, 0); };
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

  // Um bump por criança: completar a Coleção pelo complemento exato.
  const bumpsDisp = useMemo(() => {
    if (!catalogo) return [];
    return criancas
      .filter((x) => !x.colecao && (x.sel.length > 0 || x.relampago))
      .map((x) => ({
        id: x.id, nome: displayName(x),
        dif: precoColecao(x, catalogo) - precoCrianca(x, catalogo),
        faltam: faltantesTxt(x, catalogo),
      }))
      .filter((b) => b.dif > 0);
  }, [criancas, catalogo]);
  const totalFinal = totalPedido + bumpsDisp.reduce((a, b) => a + (bumpsSel[b.id] ? b.dif : 0), 0);
  const aplicarBumps = (lista: Crianca[]) =>
    lista.map((x) => bumpsSel[x.id] && !x.colecao
      ? { ...x, colecao: true, relampago: false, autoPromo: false } : x);

  // ── handoff: mesmo orderData do ModalVanilla → /pagamento ──
  function fazerPagamento() {
    if (!catalogo || enviando) return;
    const email = contato.email.trim().toLowerCase();
    const tel = (contato.telefone || '').replace(/\D/g, '');
    if (!contato.fullName.trim() || !email.includes('@') || tel.length < 10) {
      setErroContato('Preencha seu nome, WhatsApp e e-mail para receber as cantigas.');
      return;
    }
    setEnviando(true);
    const criancasFinal = aplicarBumps(criancas); // bumps aceitos viram Coleção

    const gravacaoItems: Array<{ albumId: string; childName: string; name: string; price: number; misto?: boolean; isRelampago?: boolean }> = [];
    const childrenClean = criancasFinal.map((x) => {
      const nome = displayName(x);
      const cleanSel: string[] = [];
      if (x.relampago) {
        const a1 = catalogo.base[0];
        gravacaoItems.push({ albumId: a1?.id ?? 'album1', childName: nome, name: `${a1?.name ?? 'Álbum 1'} (Oferta Relâmpago)`, price: precoRelampago(catalogo), isRelampago: true });
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
              albumId: t?.id ?? b.id, childName: nome,
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
      return { name: x.nome, albumResult: x.albumResult, selectedAlbums: cleanSel };
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
      em: email, ph: contato.telefone,
      fn: nameParts[0] ?? null, ln: nameParts.slice(1).join(' ') || null,
      children: criancasFinal.map((x) => ({ nome: displayName(x), resumo: resumoCrianca(x, catalogo) })),
    }, { email, phone: contato.telefone, fullName: contato.fullName });

    localStorage.setItem('orderData', JSON.stringify({
      customerData: { fullName: contato.fullName.trim(), email, telefone: normalizePhoneBR(tel) ?? tel },
      children: childrenClean,
      albumsAPI: Object.values(catalogo.porId),
      productName: 'Cantigas Personalizadas',
      total: totalFinal.toFixed(2),
      isCombo: criancasFinal.some((x) => x.colecao),
      gravacaoItems,
      skipOrderBumps: true, // bumps já resolvidos AQUI (um por criança, complemento da Coleção)
      sourcePath: '/campanha3',
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
    if (!email.includes('@') && (contato.telefone || '').replace(/\D/g, '').length < 10) return;
    trackBoth('Lead', {
      event_name: 'Lead', event_id: `Lead_${Date.now()}`, value: 1,
      lead: { name: contato.fullName || undefined, email: email || undefined, phone: normalizePhoneBR(contato.telefone) ? `+${normalizePhoneBR(contato.telefone)}` : undefined },
    }, { email, phone: contato.telefone, fullName: contato.fullName });
  }

  if (!catalogo) {
    return <div className="py-16 text-center font-bold text-white">Carregando as cantigas… 🎵</div>;
  }

  const anyGrav = criancas.some((x) => (x.colecao && nFalt(x, catalogo) > 0) || x.sel.some((id) => !temAlbum(x, id)));
  const allGrav = criancas.length > 0 && criancas.every((x) => foundCount(x) === 0);

  // ═══════════════ TELAS ═══════════════
  return (
    <div className="mx-auto w-full max-w-[430px] px-3.5 pb-24 pt-4">
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
          <Balao>Aqui está a amostra de {displayName(c)}! Aperte o play para ouvir</Balao>
          <div className="rounded-[22px] bg-white p-5 shadow-lg">
            <PlayerAmostra
              src={medley?.src ?? catalogo.base[0]?.linkAmostra}
              cues={medley?.cues}
              capaPorAlbum={capaPorAlbum}
              capa={catalogo.base[0]?.linkImgAlbum}
              cantiga="Ciranda Cirandinha"
              nome={displayName(c)}
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
            <div className="mb-3.5">
              {criancas.map((x) => (
                <span key={x.id} className="m-0.5 mr-1 inline-flex items-center gap-1.5 rounded-xl border-2 border-[#BEE4F7] bg-[#EAF6FD] px-3 py-1.5 text-[14.5px] font-extrabold text-[#0A8FC7]">
                  🎵 {displayName(x)} · {resumoCrianca(x, catalogo)} · {fmtBRL(precoCrianca(x, catalogo))}
                </span>
              ))}
            </div>
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
              {bumpsDisp.filter((b) => bumpsSel[b.id]).map((b) => (
                <div key={b.id} className="flex justify-between gap-2 border-b border-dashed border-[#D8D9E8] py-1.5 text-[15px] font-bold last:border-0">
                  <span>🎁 Completar coleção — {b.nome}</span>
                  <span className="whitespace-nowrap font-extrabold">+ {fmtBRL(b.dif)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 font-display text-[19px] font-bold">
                <span>Total</span><span className="text-[22px] text-[#3FA744]">{fmtBRL(totalFinal)}</span>
              </div>
            </div>

            {bumpsDisp.map((b) => (
              <div key={b.id}
                onClick={() => setBumpsSel((p) => ({ ...p, [b.id]: !p[b.id] }))}
                className={`mt-3.5 flex cursor-pointer items-start gap-3 rounded-[18px] border-[3px] border-dashed border-[#F2762E] bg-[#FFF6EF] p-3.5 ${bumpsSel[b.id] ? '' : ''}`}>
                <div className={`mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border-[3px] border-[#F2762E] text-[19px] font-black text-white ${bumpsSel[b.id] ? 'bg-[#F2762E]' : 'bg-white'}`}>
                  {bumpsSel[b.id] ? '✓' : ''}
                </div>
                <div>
                  <h4 className="font-display text-[16.5px] font-bold leading-tight text-[#B4531A]">
                    🎁 Complete a coleção de {b.nome} por + {fmtBRL(b.dif)}
                  </h4>
                  <p className="mt-1 text-[14px] font-bold leading-snug text-[#7A4A22]">
                    Adicione {b.faltam} e leve as 25 cantigas incluindo o Parabéns com o nome de {b.nome}.
                  </p>
                </div>
              </div>
            ))}
            <label className="mt-3 block text-[14px] font-extrabold text-[#8A8AA3]">Seu nome</label>
            <input className="mt-1.5 w-full rounded-2xl border-[2.5px] border-[#D8D9E8] px-4 py-3.5 text-[17px] font-bold outline-none focus:border-[#12B3F2]"
              placeholder="Nome completo" autoComplete="name"
              value={contato.fullName} onChange={(e) => setContato({ ...contato, fullName: e.target.value })} />
            <label className="mt-3 block text-[14px] font-extrabold text-[#8A8AA3]">Seu WhatsApp</label>
            <input className="mt-1.5 w-full rounded-2xl border-[2.5px] border-[#D8D9E8] px-4 py-3.5 text-[17px] font-bold outline-none focus:border-[#12B3F2]"
              placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel"
              value={contato.telefone} onChange={(e) => setContato({ ...contato, telefone: e.target.value })} />
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
