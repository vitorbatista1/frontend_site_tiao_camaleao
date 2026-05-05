import { useEffect, useState } from 'react';

interface Album {
  id: string;
  name: string;
  linkAmostra: string;
  linkImgAlbum: string;
  priceOld: number;
  priceNew: number;
  campanha: string;
}

interface AlbumFormData {
  name: string;
  linkAmostra: string;
  linkImgAlbum: string;
  priceOld: number;
  priceNew: number;
  campanha: string;
}

interface AlbumManagerProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function AlbumManager({ authenticatedFetch }: AlbumManagerProps) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<AlbumFormData>({
    name: '',
    linkAmostra: '',
    linkImgAlbum: '',
    priceOld: 0,
    priceNew: 0,
    campanha: '',
  });

  const API_URL = import.meta.env.PUBLIC_API_URL;

  // Buscar álbuns da API
  const fetchAlbums = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/api/albums`);
      
      if (response.ok) {
        const data = await response.json();
        const albums = (data.data || []).map((a: Album) => ({
          ...a,
          priceOld: Number(a.priceOld),
          priceNew: Number(a.priceNew),
        }));
        setAlbums(albums);
      }
    } catch (error) {
      console.error('Erro ao buscar álbuns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('price') ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await authenticatedFetch(`${API_URL}/api/albums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        resetForm();
        await fetchAlbums();
      } else {
        const error = await response.json();
        alert(`Erro ao criar álbum: ${error.message || 'Tente novamente'}`);
      }
    } catch (error) {
      console.error('Erro ao criar álbum:', error);
      alert('Erro ao criar álbum. Tente novamente.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      linkAmostra: '',
      linkImgAlbum: '',
      priceOld: 0,
      priceNew: 0,
      campanha: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando álbuns...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciar Álbuns</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Álbum
        </button>
      </div>

      {albums.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Nenhum álbum encontrado.</p>
          <p className="text-gray-400 text-sm mt-2">Clique em "Adicionar Álbum" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <div key={album.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {album.linkImgAlbum && (
                <img
                  src={album.linkImgAlbum}
                  alt={album.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="font-semibold text-lg text-gray-800 mb-2">{album.name}</h3>
                {album.campanha && (
                  <p className="text-sm text-blue-600 mb-2">Campanha: {album.campanha}</p>
                )}
                <div className="flex items-center gap-2 mb-3">
                  {album.priceOld > 0 && (
                    <span className="text-gray-400 line-through text-sm">
                      R$ {album.priceOld.toFixed(2)}
                    </span>
                  )}
                  <span className="text-green-600 font-bold text-xl">
                    R$ {album.priceNew.toFixed(2)}
                  </span>
                </div>
                {album.linkAmostra && (
                  <audio controls className="w-full mt-2" controlsList="nodownload">
                    <source src={album.linkAmostra} type="audio/mpeg" />
                    Seu navegador não suporta áudio.
                  </audio>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal (mesmo código de antes) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Adicionar Novo Álbum</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Álbum *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Cantigas para Dormir Vol. 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link da Amostra (MP3)
                </label>
                <input
                  type="url"
                  name="linkAmostra"
                  value={formData.linkAmostra}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://meusite.com/amostra.mp3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link da Imagem do Álbum
                </label>
                <input
                  type="url"
                  name="linkImgAlbum"
                  value={formData.linkImgAlbum}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://meusite.com/capa.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço Antigo
                </label>
                <input
                  type="number"
                  name="priceOld"
                  value={formData.priceOld}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="49.90"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço Novo *
                </label>
                <input
                  type="number"
                  name="priceNew"
                  value={formData.priceNew}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="29.90"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campanha
                </label>
                <input
                  type="text"
                  name="campanha"
                  value={formData.campanha}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: CAMPANHA1"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Criar Álbum
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}