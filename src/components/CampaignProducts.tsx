import { useEffect, useState } from 'react';

const API_URL = import.meta.env.PUBLIC_API_URL;

interface Album {
  id: string;
  name: string;
  linkAmostra: string;
  linkImgAlbum: string;
  priceOld: number;
  priceNew: number;
  campanha: string;
  tipo?: string;
}

function formatPrice(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function openBuyModal(name: string, priceNew: number) {
  window.dispatchEvent(
    new CustomEvent('open-modal', {
      detail: { name, price: `R$ ${formatPrice(priceNew)}`, combo: false },
    })
  );
}

function getImageUrl(url: string): string {
  if (!url) return '';
  
  // Limpa espaços extras
  let cleanUrl = url.trim();
  
  // Remove trailing spaces que podem vir do JSON
  cleanUrl = cleanUrl.replace(/\s+$/, '');
  
  // Se for URL do Google Drive (formato folder)
  if (cleanUrl.includes('drive.google.com/drive/folders')) {
    const match = cleanUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      // Para pastas do Google Drive, usamos o thumbnail
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w512`;
    }
  }
  
  // Se for URL de arquivo do Google Drive
  if (cleanUrl.includes('drive.google.com/file/d/')) {
    const match = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w512`;
    }
  }
  
  // Se for URL do lh3.googleusercontent.com (já é URL direta de imagem)
  if (cleanUrl.includes('lh3.googleusercontent.com')) {
    // Remove espaços e caracteres invisíveis
    return cleanUrl;
  }
  
  return cleanUrl;
}

function AlbumCard({ album }: { album: Album }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getImageUrl(album.linkImgAlbum);

  return (
    <article className="rounded-3xl bg-white p-6 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.25)]">
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={album.name}
          className="mx-auto w-full max-w-[220px] rounded-2xl object-cover aspect-square"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div
          className="mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl border-2 border-dashed text-center text-sm font-medium"
          style={{
            borderColor: 'hsl(96 45% 50% / 0.5)',
            background: 'hsl(96 45% 50% / 0.08)',
            color: 'hsl(96 45% 35%)',
          }}
        >
          {imgError ? 'Imagem indisponível' : album.name}
        </div>
      )}

      <h3
        className="mt-5 text-center text-2xl"
        style={{ color: 'hsl(220 35% 18%)', fontFamily: 'Fredoka, sans-serif' }}
      >
        {album.name}
      </h3>

      <div className="mt-1 flex items-center justify-center gap-3">
        {album.priceOld > 0 && (
          <span className="text-lg text-gray-400 line-through">
            R$ {formatPrice(album.priceOld)}
          </span>
        )}
        <p className="text-center text-2xl font-extrabold" style={{ color: 'hsl(0 78% 55%)' }}>
          R$ <span className="text-3xl">{formatPrice(album.priceNew)}</span>
        </p>
      </div>

      {album.linkAmostra && (
        <a
          href={album.linkAmostra}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-4 flex w-fit items-center gap-3 rounded-2xl px-4 py-2 transition-transform hover:scale-105"
          style={{
            background: 'hsl(48 100% 60%)',
            boxShadow: '0 4px 0 0 hsl(35 80% 35% / 0.45)',
          }}
          aria-label={`Ouvir amostra do ${album.name}`}
        >
          <p className="text-xs font-bold leading-tight" style={{ color: 'hsl(220 35% 18%)' }}>
            Clique para ouvir
          </p>
          <span
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ background: 'hsl(0 0% 100%)' }}
          >
            ▶
          </span>
        </a>
      )}

      <button
        type="button"
        onClick={() => openBuyModal(album.name, album.priceNew)}
        className="mt-5 flex w-full items-center justify-center gap-3 rounded-full px-6 py-3 font-bold uppercase tracking-wide text-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
        style={{
          background: 'hsl(0 78% 55%)',
          color: 'hsl(0 0% 100%)',
          boxShadow: '0 5px 0 0 hsl(0 70% 35% / 0.5)',
        }}
      >
        Comprar agora 🛒
      </button>
    </article>
  );
}

export default function CampaignProducts({ campaignId }: { campaignId: string }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/albums`)
      .then((r) => r.json())
      .then((data) => {
        console.log('Dados recebidos:', data);
        
        const list = (data.data ?? [])
          .filter((a: Album) => {
            const matchesCampaign = a.campanha?.toUpperCase() === campaignId.toUpperCase();
            const isNotCombo = a.tipo?.toUpperCase() !== 'COMBO';
            return matchesCampaign && isNotCombo;
          })
          .map((a: Album) => ({
            ...a,
            priceOld: Number(a.priceOld),
            priceNew: Number(a.priceNew),
            // Limpa a URL da imagem
            linkImgAlbum: a.linkImgAlbum?.trim() || '',
          }));
        
        console.log('Álbuns filtrados:', list);
        setAlbums(list);
      })
      .catch((error) => {
        console.error('Erro ao buscar álbuns:', error);
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

  const cols = albums.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  return (
    <section id="produtos" className="py-20" style={{ background: 'hsl(96 45% 50%)' }}>
      <div className="container mx-auto px-4">
        <h2
          className="text-center text-4xl md:text-5xl"
          style={{ color: 'hsl(0 0% 100%)', fontFamily: 'Fredoka, sans-serif' }}
        >
          Nossos produtos
        </h2>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <p className="text-white/80 text-lg">Carregando álbuns...</p>
          </div>
        ) : albums.length === 0 ? (
          <div className="mt-12 flex justify-center">
            <p className="text-white/80 text-lg">Nenhum álbum disponível no momento.</p>
          </div>
        ) : (
          <div className={`mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-1 md:grid-cols-2 ${cols}`}>
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}