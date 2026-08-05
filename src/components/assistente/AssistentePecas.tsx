// [ASSISTENTE 2026-07] Peças visuais — mesmo tom do design system das campanhas
// (Nunito/Baloo, azul #12B3F2, verde #3FA744) usando Tailwind com valores arbitrários.
import React, { useEffect, useRef, useState } from 'react';

const ICONE_TIAO = '/imagens/campanha2/icone_tiao.png';
const WA_ICON = '/icons/WhatsApp.png';

export function Balao({ children }: { children: React.ReactNode }) {
  return (
    <div className="balao-in flex items-start gap-2.5 bg-white rounded-[18px] rounded-bl-[4px] px-4 py-3.5 mb-3 shadow-[0_4px_14px_rgba(0,40,70,0.15)] text-[17px] font-bold leading-snug text-[#2B2B4E]">
      <img src={ICONE_TIAO} alt="" className="w-8 h-8 rounded-full shrink-0 mt-px object-contain" />
      <div>{children}</div>
    </div>
  );
}

export function BotaoPrimario(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`block w-full rounded-2xl px-4 py-4 font-display font-bold text-[19px] leading-tight text-white bg-[#3FA744] shadow-[0_5px_0_#2E7D33] active:translate-y-[3px] active:shadow-[0_2px_0_#2E7D33] disabled:opacity-50 disabled:pointer-events-none ${className}`}
    />
  );
}

export function BotaoWhatsApp({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 font-display font-bold text-[17px] text-white bg-[#25D366] shadow-[0_5px_0_#128C4A] active:translate-y-[3px] active:shadow-[0_2px_0_#128C4A]"
    >
      <img src={WA_ICON} alt="" className="h-6 w-6" />
      {children}
    </button>
  );
}

export function LinkDiscreto({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-3.5 block w-full text-center text-[15px] font-bold text-[#8A8AA3] underline">
      {children}
    </button>
  );
}

// Selo de prova social — mesmo padrão dos anúncios estáticos da casa.
export function SeloProva() {
  return (
    <div className="mt-2.5 text-center text-[12.5px] font-extrabold leading-snug text-[#8A8AA3]">
      Gravado em estúdio pelo Bruno Grossi, a voz do Tião · Desde 2013 · Mais de 2.000 nomes
    </div>
  );
}

// Régua de entrega — 1ª linha dinâmica conforme gravação no pedido.
export function ReguaEntrega({ anyGrav, allGrav }: { anyGrav: boolean; allGrav: boolean }) {
  const linha1 = allGrav
    ? ['🎙️', 'Gravado sob encomenda · entrega em até 7 dias no seu WhatsApp e e-mail']
    : anyGrav
      ? ['⚡', 'Álbuns prontos chegam na hora no seu WhatsApp e e-mail · gravações em até 7 dias']
      : ['⚡', 'Entrega na hora no seu WhatsApp e e-mail'];
  const itens = [
    linha1,
    ['🎧', 'Ouça no celular, sem instalar nada — gente de toda idade usa numa boa'],
    ['⬇️', 'Baixe as cantigas para guardar como quiser — pendrive, computador, onde preferir'],
    ['🎁', 'Envie de presente com dedicatória personalizada — até pra quem mora longe'],
  ];
  return (
    <div className="mt-3.5 rounded-[14px] bg-[#F7F8FC] px-3.5 py-3">
      {itens.map(([ic, txt]) => (
        <div key={txt} className="flex items-start gap-2 py-0.5 text-[13.5px] font-bold leading-snug text-[#55556F]">
          <span className="shrink-0">{ic}</span>
          <span>{txt}</span>
        </div>
      ))}
    </div>
  );
}

export interface MedleyCue { album: number; cantiga: string; start: number; end: number }

const capitalizar = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

// Player de amostra: toca o MEDLEY do nome (bucket) e troca capa + título
// conforme o trecho (cues do JSON gerado junto com o MP3). Sem cues, opera
// no modo simples (capa/cantiga fixas — ex.: linkAmostra do DB como fallback).
export function PlayerAmostra({
  src, srcFallback, capa, cantiga, nome, subtitulo, cues, capaPorAlbum, onFirstPlay,
}: {
  src?: string; srcFallback?: string; capa?: string; cantiga: string; nome?: string; subtitulo?: string;
  cues?: MedleyCue[]; capaPorAlbum?: Record<number, string | undefined>;
  onFirstPlay?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [pct, setPct] = useState(0);
  const [dur, setDur] = useState(0);
  const [cueAtual, setCueAtual] = useState<MedleyCue | null>(cues?.[0] ?? null);
  const firstPlay = useRef(false);
  // [AUDIO-FALLBACK 2026-08] Se o MP3 principal (medley do bucket) falhar,
  // troca sozinho para o srcFallback (linkAmostra do DB) e loga a URL que
  // falhou — o player NUNCA fica mudo por erro de origem/URL/permissão.
  const [srcAtual, setSrcAtual] = useState(src);
  const usandoFallback = !!srcFallback && srcAtual === srcFallback && srcFallback !== src;
  useEffect(() => { setSrcAtual(src); setCueAtual(cues?.[0] ?? null); setPct(0); }, [src]);
  const irParaFallback = () => {
    if (!srcFallback || srcAtual === srcFallback) return false;
    console.warn('[PlayerAmostra] áudio falhou, usando fallback. URL com problema:', srcAtual);
    setSrcAtual(srcFallback);
    setCueAtual(null);
    setPct(0);
    const el = audioRef.current;
    if (el) {
      el.src = srcFallback;
      el.load();
      el.play().then(() => setTocando(true)).catch(() => setTocando(false));
    }
    return true;
  };
  const cuesAtivos = usandoFallback ? undefined : cues;
  const capaExibida = usandoFallback ? capa : ((cueAtual && capaPorAlbum?.[cueAtual.album]) || capa);
  const tituloExibido = usandoFallback ? cantiga : (cueAtual ? capitalizar(cueAtual.cantiga) : cantiga);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (tocando) { el.pause(); setTocando(false); return; }
    el.play().then(() => {
      setTocando(true);
      if (!firstPlay.current) { firstPlay.current = true; onFirstPlay?.(); }
    }).catch(() => {
      // play() rejeitado (404/403/formato): tenta o fallback na mesma ação
      if (irParaFallback() && !firstPlay.current) { firstPlay.current = true; onFirstPlay?.(); }
    });
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="my-3 rounded-[18px] border-2 border-[#E2D9FB] bg-[#F6F3FF] px-3.5 py-4 text-center">
      {/* [AJUSTES 2026-08] Capa maior: 112px mobile (cabe na 1ª dobra), 176px desktop */}
      {capaExibida && <img src={capaExibida} alt="Capa do álbum" className="mx-auto mb-2 h-28 w-28 rounded-[14px] object-cover shadow-[0_4px_12px_rgba(60,30,120,0.2)] transition-opacity duration-300 md:h-44 md:w-44" />}
      <div className="font-display text-[18px] font-bold leading-tight text-[#2B2B4E]">{tituloExibido}</div>
      <div className="mt-0.5 text-[14px] font-bold text-[#55556F]">
        {subtitulo ?? (<>personalizada para <b className="text-[#7C5CE0]">{nome}</b></>)}
      </div>
      {/* [AJUSTES 2026-08] Play/pause em SVG inline — os glifos ▶/❚❚ renderizavam torto
          conforme o SO (feio no desktop Windows). SVG é idêntico em qualquer tela.
          A lógica do toggle NÃO foi alterada — só o desenho dentro do botão. */}
      <button
        onClick={toggle}
        aria-label={tocando ? 'Pausar' : 'Ouvir'}
        className="mx-auto mt-3 flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[#7C5CE0] text-white shadow-[0_4px_0_#5A3FB8] active:translate-y-0.5 active:shadow-[0_2px_0_#5A3FB8]"
      >
        {tocando ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="5" y="4" width="5" height="16" rx="1.5" />
            <rect x="14" y="4" width="5" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-1">
            <path d="M7 4.9v14.2c0 .93 1.02 1.5 1.81 1.01l11.3-7.1a1.19 1.19 0 0 0 0-2.02L8.81 3.89C8.02 3.4 7 3.97 7 4.9z" />
          </svg>
        )}
      </button>
      <div className="mt-2 text-[14.5px] font-extrabold text-[#7C5CE0]">
        {tocando ? 'Tocando… 🎶' : pct > 0 ? 'Ouvir de novo' : 'Clique para ouvir'}
      </div>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-md bg-[#E2D9FB]">
        <i className="block h-full rounded-md bg-[#7C5CE0] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[12.5px] font-extrabold text-[#8A8AA3]">
        <span>{fmt((pct / 100) * dur)}</span><span>{dur ? fmt(dur) : '--:--'}</span>
      </div>
      <audio
        ref={audioRef}
        src={srcAtual}
        preload="metadata"
        onError={() => { irParaFallback(); }}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setPct((el.currentTime / el.duration) * 100);
          if (cuesAtivos?.length) {
            const t = el.currentTime;
            const atual = [...cuesAtivos].reverse().find((cu) => t >= cu.start) ?? cuesAtivos[0];
            if (atual !== cueAtual) setCueAtual(atual);
          }
        }}
        onEnded={() => { setTocando(false); setPct(0); }}
      />
    </div>
  );
}
