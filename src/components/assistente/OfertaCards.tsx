// [ASSISTENTE 2026-09] Cards da oferta — multi-seleção com promoção automática
// pra Coleção quando (3 marcados) ou (soma ≥ preço da coleção). Preços do DB.
// Ordem de exibição: Álbum 1, 2, 3 e por último a Coleção.
import React from 'react';
import {
  type Catalogo, type Crianca, num, temAlbum, nFalt, mistoElegivel,
  precoAlbumBase, precoColecao, deColecao, displayName,
} from './assistente.types';

const fmtBRL = (v: number) => `R$ ${Math.round(v) === v ? v : v.toFixed(2).replace('.', ',')}`;

function ChecklistRepertorio({ album, nome }: { album: { name: string; repertorio?: unknown }; nome: string }) {
  const faixas: Array<string | { title?: string; nome?: string; personalizada?: boolean }> =
    Array.isArray(album.repertorio) ? (album.repertorio as any) : [];
  if (!faixas.length) return null;
  return (
    <div className="mt-2">
      <h4 className="mb-1 text-[12.5px] font-extrabold tracking-wide text-[#8A8AA3]">{album.name.toUpperCase()}</h4>
      {faixas.map((f, i) => {
        const titulo = typeof f === 'string' ? f : (f.title ?? f.nome ?? '');
        const pers = typeof f === 'string' ? /personalizad/i.test(f) : !!f.personalizada || /personalizad/i.test(titulo);
        const limpo = titulo.replace(/\s*[—-]\s*personalizada?/i, '');
        return (
          <div key={i} className="flex gap-2 py-0.5 text-[14px] font-bold text-[#55556F]">
            <span>🔒</span>
            <span>{limpo}{pers ? ` – ${nome}` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function BadgeGravacao({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-[10px] border border-[#F2E2AC] bg-[#FFF9E8] px-2.5 py-1.5 text-[12.5px] font-extrabold leading-snug text-[#8A6A12]">
      {children}
    </div>
  );
}

interface CardProps {
  crianca: Crianca;
  catalogo: Catalogo;
  listaAberta: string | null;
  setListaAberta: (v: string | null) => void;
  onToggleColecao: () => void;
  onToggleAlbum: (baseId: string) => void;
  onDesfazerPromo: () => void;
}

export default function OfertaCards({
  crianca: c, catalogo: cat, listaAberta, setListaAberta,
  onToggleColecao, onToggleAlbum, onDesfazerPromo,
}: CardProps) {
  const nome = displayName(c);
  const faltantes = nFalt(c, cat);
  const pc = precoColecao(c, cat);
  const de = deColecao(c, cat);
  const economia = Math.max(0, de - pc);
  const misto = mistoElegivel(c, cat) && num(cat.comboGravacao?.priceMistoNew) > 0;

  const Check = ({ on }: { on: boolean }) => (
    <div className={`mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border-[3px] text-base font-black text-white ${on ? 'border-[#3FA744] bg-[#3FA744]' : 'border-[#C9C9DC] bg-white'}`}>
      {on ? '✓' : ''}
    </div>
  );

  return (
    <>
      {/* ── Álbuns individuais (1 → 2 → 3, ordem crescente) ── */}
      {cat.base.map((b) => {
        const off = c.colecao;
        const sel = !off && c.sel.includes(b.id);
        const grava = !temAlbum(c, b.id);
        const preco = precoAlbumBase(c, b.id, cat);
        const ultimo = b === cat.base[cat.base.length - 1];
        const aberta = listaAberta === b.id;
        return (
          <div
            key={b.id}
            onClick={() => onToggleAlbum(b.id)}
            className={`mt-3 cursor-pointer rounded-[18px] border-[3px] p-3.5 transition-opacity ${sel ? 'border-[#3FA744] bg-[#EDF7EE]' : off ? 'border-[#E4E5EF] bg-[#F3F4F9]' : 'border-[#D8D9E8] bg-white'}`}
          >
            <div className={`flex items-start gap-2.5 ${off ? 'opacity-50' : ''}`}>
              <Check on={sel} />
              {b.linkImgAlbum && (
                <img src={b.linkImgAlbum} alt="" loading="lazy" decoding="async" width={54} height={54} className={`mt-px h-[54px] w-[54px] shrink-0 rounded-[10px] object-cover shadow ${sel ? 'outline outline-2 outline-[#3FA744]' : ''}`} />
              )}
              <div className="flex-1">
                <h3 className="font-display text-[17.5px] font-bold leading-tight">{b.name}{ultimo ? ' · LANÇAMENTO!' : ''}</h3>
                <div className="mt-0.5 text-[14px] font-bold leading-snug text-[#55556F]">
                  {ultimo ? '10 cantigas personalizadas' : '7 cantigas personalizadas + Parabéns personalizado'}
                </div>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <div className={`font-display text-[22px] font-extrabold leading-none ${sel ? 'text-[#3FA744]' : 'text-[#2B2B4E]'}`}>{fmtBRL(preco)}</div>
              </div>
            </div>
            {grava && !off && (
              <BadgeGravacao>
                🎙️ O nome {nome} ainda não está neste álbum — gravamos sob encomenda: valor já incluído · entrega em até 7 dias
              </BadgeGravacao>
            )}
            {off && (
              <div className="mt-2 text-[13px] font-extrabold text-[#3FA744]">
                ✔ Já incluído na Coleção Completa — toque para escolher só este
              </div>
            )}
            {!off && (
              <button
                onClick={(e) => { e.stopPropagation(); setListaAberta(aberta ? null : b.id); }}
                className="mt-2 text-[13.5px] font-extrabold text-[#0A8FC7] underline"
              >
                {aberta ? 'Esconder a lista de cantigas ▴' : 'Ver lista de cantigas ▾'}
              </button>
            )}
            {aberta && !off && <ChecklistRepertorio album={b} nome={nome} />}
          </div>
        );
      })}

      {/* ── Coleção Completa ── */}
      <div
        onClick={onToggleColecao}
        className={`relative mt-3 cursor-pointer rounded-[18px] border-[3px] p-3.5 ${c.colecao ? 'border-[#3FA744] bg-[#EDF7EE]' : 'border-[#D8D9E8] bg-white'}`}
      >
        <div className="absolute -top-3 left-3.5">
          <span className="rounded-[10px] bg-[#FFD34E] px-2.5 py-1 text-[12px] font-extrabold text-[#6B4E00]">
            O PREFERIDO DAS FAMÍLIAS 💜
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <Check on={c.colecao} />
          {cat.combo?.linkImgAlbum && (
            <img src={cat.combo.linkImgAlbum} alt="" loading="lazy" decoding="async" width={54} height={54} className={`mt-px h-[54px] w-[54px] shrink-0 rounded-[10px] object-cover shadow ${c.colecao ? 'outline outline-2 outline-[#3FA744]' : ''}`} />
          )}
          <div className="flex-1">
            <h3 className="font-display text-[17.5px] font-bold leading-tight">{cat.combo?.name ?? 'Coleção Completa'} · Álbuns 1, 2 e o NOVO Álbum 3</h3>
            <div className="mt-0.5 text-[14px] font-bold leading-snug text-[#55556F]">25 cantigas incluindo o Parabéns personalizado</div>
          </div>
          <div className="ml-auto shrink-0 text-right">
            {de > pc && <div className="text-[13px] font-bold text-[#8A8AA3] line-through">{fmtBRL(de)}</div>}
            <div className={`font-display text-[22px] font-extrabold leading-none ${c.colecao ? 'text-[#3FA744]' : 'text-[#2B2B4E]'}`}>{fmtBRL(pc)}</div>
          </div>
        </div>
        {economia > 0 && <div className="mt-2 text-[12.5px] font-extrabold text-[#3FA744]">✨ você economiza {fmtBRL(economia)}</div>}
        {faltantes > 0 && (
          <BadgeGravacao>
            🎙️ Inclui a gravação de estúdio de {faltantes === cat.base.length ? 'todos os álbuns' : `${faltantes} álbum(s)`} para {nome}
            {misto ? ' · preço especial de quem já é da família' : ''} · valor já incluído no preço
          </BadgeGravacao>
        )}
        {c.colecao && c.autoPromo && (
          <div className="mt-3 rounded-[14px] border-2 border-[#D5C8F7] bg-[#F0EBFF] px-3 py-2.5 text-[14px] font-bold leading-snug text-[#4B3A8F]">
            ✨ Suas escolhas somariam {fmtBRL(c.somaAntes ?? 0)} — com os 3 álbuns na Coleção sai por {fmtBRL(pc)}. Aplicamos o melhor preço pra você.
            <button onClick={(e) => { e.stopPropagation(); onDesfazerPromo(); }} className="ml-1 font-extrabold text-[#7C5CE0] underline">Desfazer</button>
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setListaAberta(listaAberta === 'colecao' ? null : 'colecao'); }}
          className="mt-2 text-[13.5px] font-extrabold text-[#0A8FC7] underline"
        >
          {listaAberta === 'colecao' ? 'Esconder a lista de cantigas ▴' : 'Ver lista de cantigas ▾'}
        </button>
        {listaAberta === 'colecao' && cat.base.map((b) => <ChecklistRepertorio key={b.id} album={b} nome={nome} />)}
      </div>
    </>
  );
}
