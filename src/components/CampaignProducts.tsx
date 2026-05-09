// CampaignProducts.tsx
import { ShoppingCart, Play } from "./Icons.tsx";

const albumData = [
  {
    id: 1,
    title: "Álbum 1",
    price: "R$ 47,00",
    tracks: [
      "Apresentação",
      "Ciranda Cirandinha – personalizada",
      "Bote Aqui o Seu Pezinho – personalizada",
      "O Sapo Não Lava o Pé",
      "Alecrim Dourado – personalizada",
      "10 Indiozinhos – personalizada",
      "Cai Cai Balão",
      "Marcha Soldado – personalizada",
      "Samba Lelê – personalizada",
      "Dona Aranha",
      "Fonte do Tororó – personalizada",
    ],
    note: "São 7 cantigas personalizadas\ncom o nome da criança!",
    audioSrc: "/audio/amostra1.mp3",
  },
  {
    id: 2,
    title: "Álbum 2",
    price: "R$ 47,00",
    tracks: [
      "Apresentação",
      "Sabiá na Gaiola – personalizada",
      "Sapo Jururu – personalizada",
      "Formiguinha",
      "Peixe Vivo – personalizada",
      "Meu Limão, Meu Limoeiro – personalizada",
      "Pai Francisco – personalizada",
      "Escravos de Jó",
      "Pirulito que Bate-Bate – personalizada",
      "Se Essa Rua Fosse Minha – personalizada",
    ],
    note: "São 7 cantigas personalizadas\ncom o nome da criança!",
    audioSrc: "/audio/amostra2.mp3",
  },
];

interface Props {
  campaignId: string;
  album1Src: string;
  album2Src: string;
  album1Srcset: string;
  album2Srcset: string;
  albumSizes: string;
}

export default function CampaignProducts({ campaignId, album1Src, album2Src, album1Srcset, album2Srcset, albumSizes }: Props) {
  const albums = albumData.map((a, i) => ({
    ...a,
    image: i === 0 ? album1Src : album2Src,
    srcset: i === 0 ? album1Srcset : album2Srcset,
  }));

  return (
    <section id="produtos" style={{ background: "#6ab248" }} className="py-14 px-4">
      <h2 className="text-center text-3xl md:text-4xl font-bold text-white mb-16">
        Nossos produtos
      </h2>

      <div className="flex flex-col md:flex-row gap-16 md:gap-6 justify-center items-stretch max-w-4xl mx-auto">
        {albums.map((album) => (
          <div
            key={album.id}
            className="bg-white rounded-3xl flex flex-col items-center w-full md:w-[340px]"
            style={{ paddingBottom: "1.5rem" }}
          >
            {/* Capa do álbum — sai do card com margem negativa */}
            <div className="w-full flex justify-center" style={{ marginTop: "-3.5rem" }}>
              <img
                src={album.image}
                srcSet={album.srcset}
                sizes={albumSizes}
                alt={album.title}
                width={448}
                height={448}
                className="w-48 md:w-56 object-contain"
              />
            </div>

            {/* Título e preço */}
            <div className="text-center mt-2 px-6">
              <h3 className="text-2xl font-bold text-gray-800">{album.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                R$ <span className="text-[#FF0000] text-3xl font-black">{album.price.replace("R$ ", "")}</span>
              </p>
            </div>

            {/* Lista de faixas — flex-1 para empurrar botões pro fim */}
            <ol className="mt-4 px-8 w-full space-y-1 text-sm text-gray-700 list-decimal list-inside flex-1">
              {album.tracks.map((track, i) => (
                <li key={i}>
                  {track.includes("– personalizada") ? (
                    <>
                      {track.replace("– personalizada", "")}
                      <span className="font-bold">– personalizada</span>
                    </>
                  ) : (
                    track
                  )}
                </li>
              ))}
            </ol>

            {/* Divider + nota */}
            <div className="mt-4 w-full px-8">
              <hr className="border-gray-200" />
              <p className="mt-3 text-center text-sm text-gray-500 whitespace-pre-line leading-snug">
                {album.note}
              </p>
            </div>

            {/* Botão de áudio */}
            <div
              className="mt-4 mx-8 w-[calc(100%-4rem)] rounded-2xl flex items-center gap-3 px-4 py-3"
              style={{ background: "#F2C200" }}
            >
              <button
                className="h-10 w-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow"
                aria-label="Ouvir amostra"
              >
                <Play className="h-5 w-5 fill-[#F2C200] text-[#F2C200] ml-0.5" />
              </button>
              <div className="flex flex-col flex-1">
                <span className="text-xs font-bold text-white">Clique para ouvir</span>
                <svg viewBox="0 0 120 20" className="w-full h-5 mt-0.5">
                  {[4,8,14,6,12,16,10,5,13,9,15,7,11,6,14,8,12,5,10,16,7,13,9,11,6].map((h, i) => (
                    <rect key={i} x={i * 5} y={(20 - h) / 2} width="3" height={h} rx="1.5" fill="white" opacity="0.85" />
                  ))}
                </svg>
              </div>
            </div>

            {/* Botão comprar */}
            <button
              className="mt-4 mx-8 w-[calc(100%-4rem)] rounded-full bg-[#FF0000] text-white font-bold uppercase tracking-wide py-3 flex items-center justify-center gap-2 text-sm shadow hover:bg-red-600 transition"
              data-buy
              data-buy-name={album.title}
              data-buy-price={album.price}
            >
              Comprar agora
              <ShoppingCart size={18} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
