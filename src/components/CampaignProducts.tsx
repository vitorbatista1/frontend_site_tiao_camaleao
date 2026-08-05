// CampaignProducts.tsx
import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, Play, Pause } from "./Icons.tsx";
import WhatsAppSellerButton from "./WhatsAppSellerButton.tsx";
// [TC-CAPI 2026-06] helper de pixel enriquecido
import { trackPixel } from '../lib/tracking.ts';

const API_URL = import.meta.env.PUBLIC_API_URL;

interface Faixa {
  nome: string;
  personalizada: boolean;
}

interface AlbumAPI {
  id: string;
  name: string;
  linkAmostra: string;
  priceOld: string | null;
  priceNew: string;
  campanha: string;
  tipo: string;
  repertorio: Faixa[];
}

function fmtPrice(value: string | number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

interface Props {
  campaignId: string;
}

export default function CampaignProducts({ campaignId }: Props) {
  const [albums, setAlbums] = useState<AlbumAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/albums`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) return;
        const campKey = campaignId.toUpperCase();
        const filtered = (data.data as AlbumAPI[])
          .filter(a => a.campanha === campKey && a.tipo === 'ALBUM')
          .map(a => ({ ...a, repertorio: a.repertorio ?? [] }));
        setAlbums(filtered);

        try {
          if (filtered.length && !sessionStorage.getItem('tc_vc_fired')) {
            // [TC-CAPI 2026-06] ViewContent enriquecido (sem PII nesta etapa)
            const ids = filtered.map(a => a.id);
            const eventId = `vc_${campKey}_${Date.now()}`;
            trackPixel('ViewContent', {
              content_ids: ids,
              content_type: 'product',
              content_category: 'musica_digital',
              content_name: `Campanha ${campKey}`,
              contents: ids.map(id => ({ id, quantity: 1 })),
              num_items: ids.length,
            }, { eventId })
            sessionStorage.setItem('tc_vc_fired', '1');
          }
        } catch (e) {}
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);


  async function handlePlay(album: AlbumAPI) {
    if (!album.linkAmostra) return;

    if (playingId === album.id) {
      currentAudio.current?.pause();
      setPlayingId(null);
      return;
    }

    currentAudio.current?.pause();
    const audio = new Audio(album.linkAmostra);
    currentAudio.current = audio;

    audio.onended = () => setPlayingId(null);
    audio.onerror = (e) => {
      console.error('Erro ao carregar áudio:', album.linkAmostra, e);
      setPlayingId(null);
    }
    
    try {
      await audio.play();
      setPlayingId(album.id);
    } catch (err) {
      console.error('Erro ao tentar dar play na música de amostra', err);
      setPlayingId(null);
    }
  }

  return (
    <section id="produtos" style={{ background: "#6ab248", paddingBottom: typeof window !== 'undefined' && window.innerWidth >= 768 ? "10rem" : "3.5rem" }} className="pt-14 px-4">
      <h2 className="text-center text-white mb-6 md:mb-16" style={{ fontSize: "clamp(30px, 9vw, 60px)", fontWeight: 800 }}>
        Nossos produtos
      </h2>

      <div className="flex flex-col md:flex-row gap-16 md:gap-6 justify-center items-stretch max-w-4xl mx-auto">
        {loading ? (
          [0, 1].map(i => (
            <div key={i} className="bg-white/30 rounded-3xl w-full md:w-[340px] h-[600px] animate-pulse" style={{ marginTop: "-3.5rem" }} />
          ))
        ) : albums.map((album) => {
          const priceNew = Number(album.priceNew);
          const priceOld = album.priceOld ? Number(album.priceOld) : 0;
          const tracks = album.repertorio;

          return (
            <div
              key={album.id}
              className="bg-white rounded-3xl flex flex-col items-center w-full md:w-[340px]"
              style={{ paddingBottom: "1.5rem" }}
            >

              {/* ── MOBILE: imagem esquerda + áudio/título/preço direita ── */}
              <div className="flex md:hidden w-full items-start">
                {/* Imagem à esquerda */}
                <div className="w-[52%] flex-shrink-0 flex justify-end pr-0">
                  <img
                    src={album.linkImgAlbum}
                    alt={album.name}
                    width={448}
                    height={448}
                    className="w-[90%] object-contain rounded-tl-3xl ml-auto mt-6"
                  />
                </div>
                {/* Direita: botão ouvir + título + preço */}
                <div className="flex-1 flex flex-col items-start justify-start pt-12 pl-1 pr-2 gap-2">
                  <div
                    className="rounded-xl flex flex-col px-3 py-2 gap-1"
                    style={{ background: "#F2C200" }}
                  >
                    <span className="font-bold" style={{ fontSize: "14px", lineHeight: 1, color: "#555" }}>Clique para ouvir</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-8 w-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow"
                        aria-label="Ouvir amostra"
                        onClick={() => handlePlay(album)}
                      >
                        {playingId === album.id
                          ? <Pause className="h-4 w-4 fill-[#F2C200] text-[#F2C200]" />
                          : <Play className="h-4 w-4 fill-[#F2C200] text-[#F2C200] ml-0.5" />
                        }
                      </button>
                      <svg viewBox="0 0 80 28" style={{ width: "70px", height: "22px" }}>
                        {[6,10,18,9,16,22,14,7,18,13,20,9,14,7,18,11].map((h, k) => (
                          <rect
                            key={k}
                            x={k * 5}
                            y={(28 - h) / 2}
                            width="3"
                            height={h}
                            rx="1.5"
                            fill="#888"
                            opacity="0.85"
                            style={playingId === album.id ? {
                              animation: `wave ${0.6 + (k % 4) * 0.15}s ease-in-out infinite alternate`,
                              transformOrigin: 'center',
                            } : {}}
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0 mt-6">
                    <h3 className="text-gray-800" style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1.1 }}>{album.name}</h3>
                    <span className="text-[#FF0000]" style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1 }}>
                      R$ {priceNew % 1 === 0 ? Math.floor(priceNew) : priceNew.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── DESKTOP: layout original ── */}
              <div className="hidden md:flex w-full justify-center" style={{ marginTop: "-3.5rem" }}>
                <img
                  src={album.linkImgAlbum}
                  alt={album.name}
                  width={448}
                  height={448}
                  className="w-56 object-contain"
                />
              </div>
              <div className="hidden md:block text-center mt-2 px-6">
                <h3 className="text-gray-800" style={{ fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 800 }}>{album.name}</h3>
                <p className="mt-0.5">
                  {priceOld > priceNew && (
                    <span className="line-through text-gray-400 mr-1" style={{ fontSize: "14px" }}>
                      R$ {priceOld.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                  <span className="text-[#FF0000]" style={{ fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 800 }}>
                    R$ {priceNew.toFixed(2).replace('.', ',')}
                  </span>
                </p>
              </div>

              {/* Lista de faixas */}
              <div className="mt-4 pr-8 pl-12 md:pl-4 w-full flex-1">
                {tracks.length > 0 && (
                  <>
                    <ol className="w-full space-y-0.5 list-none" style={{ fontSize: "14px", fontWeight: 500 }}>
                      {tracks.map((faixa, j) => (
                        <li key={j} className="flex gap-6">
                          <span className="text-gray-700 shrink-0 text-right" style={{ minWidth: "1.4em", fontVariantNumeric: "tabular-nums" }}>{j + 1}</span>
                          {faixa.personalizada ? (
                            <span className="text-black md:whitespace-nowrap" style={{ fontWeight: 800 }}>
                              {faixa.nome} – personalizada
                            </span>
                          ) : (
                            <span className="text-gray-700">{faixa.nome}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </>
                )} 
              </div>

              {/* Divider + nota */}
              <div className="mt-4 w-full px-8">
                <hr className="border-red-400 border-t-2" />
                <p className="mt-3 text-center whitespace-pre-line leading-snug">
                  <span className="text-red-500" style={{ fontSize: "22px", fontWeight: 800 }}>
                     7 cantigas personalizadas
                  </span>
                  <br />
                  <span className="text-gray-500" style={{ fontSize: "16px", fontWeight: 600 }}>
                    com o nome da criança!
                  </span>
                </p>
              </div>

              {/* Botão de áudio — desktop */}
              <div
                className="hidden md:flex mt-4 mx-auto w-fit rounded-2xl flex-col px-4 py-2 gap-1"
                style={{ background: "#F2C200" }}
              >
                <span className="font-bold text-center" style={{ fontSize: "13px", lineHeight: 1, color: "#555" }}>Clique para ouvir</span>
                <div className="flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow"
                    aria-label="Ouvir amostra"
                    onClick={() => handlePlay(album)}
                  >
                    {playingId === album.id
                      ? <Pause className="h-4 w-4 fill-[#F2C200] text-[#F2C200]" />
                      : <Play className="h-4 w-4 fill-[#F2C200] text-[#F2C200] ml-0.5" />
                    }
                  </button>
                  <svg viewBox="0 0 80 28" style={{ width: "70px", height: "22px" }}>
                    {[6,10,18,9,16,22,14,7,18,13,20,9,14,7,18,11].map((h, k) => (
                      <rect
                        key={k}
                        x={k * 5}
                        y={(28 - h) / 2}
                        width="3"
                        height={h}
                        rx="1.5"
                        fill="#888"
                        opacity="0.85"
                        style={playingId === album.id ? {
                          animation: `wave ${0.6 + (k % 4) * 0.15}s ease-in-out infinite alternate`,
                          transformOrigin: 'center',
                        } : {}}
                      />
                    ))}
                  </svg>
                </div>
              </div>

              {/* Botão comprar */}
              <div className="cta-group mt-4 mx-6">
                <button
                  className="btn-red-rounded whitespace-nowrap"
                  data-buy
                  data-buy-name={album.name}
                  data-buy-price={fmtPrice(album.priceNew)}
                >
                  COMPRAR AGORA
                  <ShoppingCart size={18} />
                </button>
                <WhatsAppSellerButton />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
