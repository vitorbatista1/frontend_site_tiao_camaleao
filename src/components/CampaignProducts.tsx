// CampaignProducts.tsx
import { useEffect, useState } from 'react';
import { ShoppingCart, Play } from "./Icons.tsx";

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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  return (
    <section id="produtos" style={{ background: "#6ab248" }} className="py-14 px-4">
      <h2 className="text-center text-white mb-16" style={{ fontSize: "clamp(26px, 6vw, 48px)", fontWeight: 800 }}>
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
              {/* Capa do álbum — sai do card com margem negativa */}
              <div className="w-full flex justify-center" style={{ marginTop: "-3.5rem" }}>
                <img
                  src={album.linkImgAlbum}
                  alt={album.name}
                  width={448}
                  height={448}
                  className="w-48 md:w-56 object-contain"
                />
              </div>

              {/* Título e preço */}
              <div className="text-center mt-2 px-6">
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

              {/* Lista de faixas — flex-1 para empurrar botões pro fim */}
              <div className="mt-4 px-8 w-full flex-1">
                {tracks.length > 0 && (
                  <>
                    <p className="text-gray-500 mb-1" style={{ fontSize: "14px", fontWeight: 500 }}>Repertório:</p>
                    <ol className="w-full space-y-1 list-none" style={{ fontSize: "14px", fontWeight: 500 }}>
                      {tracks.map((faixa, j) => (
                        <li key={j} className="flex gap-1">
                          <span className="text-gray-700 shrink-0">{j + 1}</span>
                          {faixa.personalizada ? (
                            <span className="text-black" style={{ fontWeight: 800 }}>
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
                  <span className="text-red-500" style={{ fontSize: "clamp(16px, 3.5vw, 22px)", fontWeight: 800 }}>
                    São 7 cantigas personalizadas
                  </span>
                  <br />
                  <span className="text-gray-500" style={{ fontSize: "16px", fontWeight: 600 }}>
                    com o nome da criança!
                  </span>
                </p>
              </div>

              {/* Botão de áudio */}
              <div
                className="mt-4 mx-auto w-fit rounded-2xl flex items-center gap-2 px-4 py-1.5"
                style={{ background: "#F2C200" }}
              >
                <button
                  className="h-8 w-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow"
                  aria-label="Ouvir amostra"
                  onClick={() => {
                    if (album.linkAmostra) new Audio(album.linkAmostra).play().catch(() => {});
                  }}
                >
                  <Play className="h-4 w-4 fill-[#F2C200] text-[#F2C200] ml-0.5" />
                </button>
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-bold text-white">Clique para ouvir</span>
                  <svg viewBox="0 0 120 20" className="w-full h-4 mt-0.5">
                    {[4,8,14,6,12,16,10,5,13,9,15,7,11,6,14,8,12,5,10,16,7,13,9,11,6].map((h, k) => (
                      <rect key={k} x={k * 5} y={(20 - h) / 2} width="3" height={h} rx="1.5" fill="white" opacity="0.85" />
                    ))}
                  </svg>
                </div>
              </div>

              {/* Botão comprar */}
              <button
                className="mt-4 mx-6 btn-red-rounded whitespace-nowrap"
                data-buy
                data-buy-name={album.name}
                data-buy-price={fmtPrice(album.priceNew)}
              >
                COMPRAR AGORA
                <ShoppingCart size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
