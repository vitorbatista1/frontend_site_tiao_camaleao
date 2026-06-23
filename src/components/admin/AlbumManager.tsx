import { useEffect, useState, useCallback } from 'react';

interface Faixa {
  nome: string;
  personalizada: boolean;
}

interface Album {
  id: string;
  name: string;
  linkAmostra: string;
  linkImgAlbum: string;
  priceOld: number;
  priceNew: number;
  campanha: string;
  tipo: 'ALBUM' | 'COMBO' | 'GRAVACAO';
  repertorio: Faixa[];
  isOrderBump: boolean;
  orderBumpDiscount: number;
}

interface AlbumFormData {
  name: string;
  linkAmostra: string;
  linkImgAlbum: string;
  priceOld: number;
  priceNew: number;
  campanha: string;
  tipo: 'ALBUM' | 'COMBO' | 'GRAVACAO';
  repertorio: Faixa[];
  isOrderBump: boolean;
  orderBumpDiscount: number;
}

interface BucketImage {
  key: string;
  url: string;
  lastModified?: string;
  size?: number;
}

interface AlbumManagerProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const EMPTY_FORM: AlbumFormData = {
  name: '',
  linkAmostra: '',
  linkImgAlbum: '',
  priceOld: 0,
  priceNew: 0,
  campanha: '',
  tipo: 'ALBUM',
  repertorio: [],
  isOrderBump: false,
  orderBumpDiscount: 0,
};

export default function AlbumManager({ authenticatedFetch }: AlbumManagerProps) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [newTrack, setNewTrack] = useState('');
  const [newTrackPersonalizada, setNewTrackPersonalizada] = useState(false);
  const [formData, setFormData] = useState<AlbumFormData>(EMPTY_FORM);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(false);
  const [imagePickerSearch, setImagePickerSearch] = useState('');

  const API_URL = import.meta.env.PUBLIC_API_URL;

  const fetchAlbums = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/api/albums`);
      if (response.ok) {
        const data = await response.json();
        setAlbums(
          (data.data || []).map((a: Album) => ({
            ...a,
            priceOld: Number(a.priceOld),
            priceNew: Number(a.priceNew),
            repertorio: a.repertorio ?? [],
          }))
        );
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const formPayload = new FormData();
      formPayload.append('imagem', file);
      const response = await authenticatedFetch(`${API_URL}/api/upload/imagens-albums`, {
        method: 'POST',
        body: formPayload,
      });
      if (response.ok) {
        const result = await response.json();
        setFormData(prev => ({ ...prev, linkImgAlbum: result.data.url }));
      } else {
        const error = await response.json();
        alert(`Erro ao enviar imagem: ${error.message || 'Tente novamente'}`);
      }
    } catch {
      alert('Erro ao enviar imagem. Tente novamente.');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const openImagePicker = useCallback(async () => {
    setShowImagePicker(true);
    setImagePickerSearch('');
    if (bucketImages.length > 0) return;
    setLoadingBucketImages(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/upload/imagens-albums`);
      if (response.ok) {
        const result = await response.json();
        setBucketImages(result.data ?? []);
      }
    } catch {
      // silently fail — user can still upload
    } finally {
      setLoadingBucketImages(false);
    }
  }, [bucketImages.length, authenticatedFetch, API_URL]);

  const handleSelectBucketImage = useCallback((url: string) => {
    setFormData(prev => ({ ...prev, linkImgAlbum: url }));
    setShowImagePicker(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : (name.includes('price') || name === 'orderBumpDiscount') ? parseFloat(value) || 0 : value,
    }));
  };

  const addTrack = () => {
    const trimmed = newTrack.trim();
    if (!trimmed) return;
    setFormData(prev => ({
      ...prev,
      repertorio: [...prev.repertorio, { nome: trimmed, personalizada: newTrackPersonalizada }],
    }));
    setNewTrack('');
    setNewTrackPersonalizada(false);
  };

  const removeTrack = (index: number) => {
    setFormData(prev => ({
      ...prev,
      repertorio: prev.repertorio.filter((_, i) => i !== index),
    }));
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    const next = direction === 'up' ? index - 1 : index + 1;
    setFormData(prev => {
      const rep = [...prev.repertorio];
      [rep[index], rep[next]] = [rep[next], rep[index]];
      return { ...prev, repertorio: rep };
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setNewTrack('');
    setNewTrackPersonalizada(false);
    setIsModalOpen(true);
  };

  const openEdit = (album: Album) => {
    setEditingId(album.id);
    setFormData({
      name: album.name,
      linkAmostra: album.linkAmostra,
      linkImgAlbum: album.linkImgAlbum,
      priceOld: album.priceOld,
      priceNew: album.priceNew,
      campanha: album.campanha,
      tipo: album.tipo,
      repertorio: album.repertorio,
      isOrderBump: album.isOrderBump ?? false,
      orderBumpDiscount: album.orderBumpDiscount ?? 0,
    });
    setNewTrack('');
    setNewTrackPersonalizada(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setNewTrack('');
    setNewTrackPersonalizada(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId
        ? `${API_URL}/api/albums/${editingId}`
        : `${API_URL}/api/albums`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        closeModal();
        await fetchAlbums();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message || 'Tente novamente'}`);
      }
    } catch {
      alert('Erro ao salvar álbum. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/albums/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setAlbums(prev => prev.filter(a => a.id !== id));
      } else {
        const error = await response.json();
        alert(`Erro ao excluir: ${error.message || 'Tente novamente'}`);
      }
    } catch {
      alert('Erro ao excluir álbum. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
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
          onClick={openCreate}
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
                <img src={album.linkImgAlbum} alt={album.name} className="w-full h-48 object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <h3 className="font-semibold text-lg text-gray-800">{album.name}</h3>
                  <div className="flex gap-1 flex-wrap">
                    {album.isOrderBump && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                        🎁 Order Bump{album.orderBumpDiscount > 0 ? ` -${album.orderBumpDiscount}%` : ''}
                      </span>
                    )}
                    {album.tipo && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        album.tipo === 'COMBO' ? 'bg-purple-100 text-purple-700'
                        : album.tipo === 'GRAVACAO' ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>
                        {album.tipo}
                      </span>
                    )}
                  </div>
                </div>
                {album.campanha && (
                  <p className="text-sm text-blue-600 mb-2">Campanha: {album.campanha}</p>
                )}
                <div className="flex items-center gap-2 mb-3">
                  {album.priceOld > 0 && (
                    <span className="text-gray-400 line-through text-sm">R$ {album.priceOld.toFixed(2)}</span>
                  )}
                  <span className="text-green-600 font-bold text-xl">R$ {album.priceNew.toFixed(2)}</span>
                </div>
                {album.repertorio.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Repertório ({album.repertorio.length} faixas)</p>
                    <ol className="text-xs text-gray-600 list-decimal list-inside space-y-0.5 max-h-32 overflow-y-auto">
                      {album.repertorio.map((faixa, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span>{faixa.nome}</span>
                          {faixa.personalizada && <span className="text-purple-500 font-semibold">★</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {album.linkAmostra && (
                  <audio controls className="w-full mt-3" controlsList="nodownload">
                    <source src={album.linkAmostra} type="audio/mpeg" />
                  </audio>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => openEdit(album)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir "${album.name}"? Esta ação não pode ser desfeita.`)) {
                        handleDelete(album.id);
                      }
                    }}
                    disabled={deletingId === album.id}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === album.id ? (
                      <span>Excluindo...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Excluir
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingId ? 'Editar Álbum' : 'Adicionar Novo Álbum'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors text-2xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Álbum *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Cantigas para Dormir Vol. 1" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link da Amostra (MP3)</label>
                <input type="url" name="linkAmostra" value={formData.linkAmostra} onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://meusite.com/amostra.mp3" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagem do Álbum</label>
                {formData.linkImgAlbum && (
                  <div className="mb-2 relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                    <img src={formData.linkImgAlbum} alt="Capa do álbum" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, linkImgAlbum: '' }))}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none"
                      title="Remover imagem"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingImg ? 'border-blue-300 bg-blue-50 text-blue-400' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-500'}`}>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">{uploadingImg ? 'Enviando...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImg}
                      onChange={handleImageUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={openImagePicker}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-gray-300 hover:border-purple-400 hover:bg-purple-50 text-gray-500 hover:text-purple-600 rounded-lg transition-colors text-sm"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Selecionar existente
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Antigo</label>
                  <input type="number" name="priceOld" value={formData.priceOld} onChange={handleInputChange}
                    step="0.01" min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="49.90" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Novo *</label>
                  <input type="number" name="priceNew" value={formData.priceNew} onChange={handleInputChange}
                    required step="0.01" min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="29.90" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campanha</label>
                <input type="text" name="campanha" value={formData.campanha} onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: campanha1" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select name="tipo" value={formData.tipo} onChange={handleInputChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                  <option value="ALBUM">ALBUM</option>
                  <option value="COMBO">COMBO</option>
                  <option value="GRAVACAO">GRAVAÇÃO</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repertório</label>
                {formData.repertorio.length > 0 && (
                  <ol className="mb-3 space-y-1">
                    {formData.repertorio.map((faixa, i) => (
                      <li key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                        <span className="flex-1 text-sm text-gray-700 truncate">{faixa.nome}</span>
                        {faixa.personalizada && <span className="text-xs text-purple-600 font-semibold shrink-0">personalizada</span>}
                        <div className="flex gap-1 shrink-0">
                          <button type="button" onClick={() => moveTrack(i, 'up')} disabled={i === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs px-1" title="Mover para cima">▲</button>
                          <button type="button" onClick={() => moveTrack(i, 'down')} disabled={i === formData.repertorio.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs px-1" title="Mover para baixo">▼</button>
                          <button type="button" onClick={() => removeTrack(i)}
                            className="text-red-400 hover:text-red-600 text-xs px-1" title="Remover">✕</button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input type="text" value={newTrack} onChange={e => setNewTrack(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTrack(); } }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Nome da faixa" />
                    <button type="button" onClick={addTrack}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                      + Adicionar
                    </button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                    <input type="checkbox" checked={newTrackPersonalizada} onChange={e => setNewTrackPersonalizada(e.target.checked)}
                      className="w-4 h-4 accent-purple-600" />
                    <span className="text-sm text-gray-600">Música personalizada</span>
                  </label>
                </div>
              </div>

              <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="isOrderBump"
                    checked={formData.isOrderBump}
                    onChange={handleInputChange}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">🎁 Marcar como Order Bump</span>
                    <p className="text-xs text-gray-500 mt-0.5">Oferecido no checkout para quem ainda não tem este álbum</p>
                  </div>
                </label>

                {formData.isOrderBump && (
                  <div className="pl-7 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Desconto no Order Bump (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          name="orderBumpDiscount"
                          value={formData.orderBumpDiscount}
                          onChange={handleInputChange}
                          min={0}
                          max={100}
                          step={1}
                          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-500">%</span>
                        {formData.orderBumpDiscount > 0 && formData.priceNew > 0 && (
                          <span className="text-sm text-green-700 font-semibold">
                            de R$ {formData.priceNew.toFixed(2)} por{' '}
                            <span className="text-green-600 font-bold">
                              R$ {(formData.priceNew * (1 - formData.orderBumpDiscount / 100)).toFixed(2)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
                  {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Álbum'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Selecionar imagem do bucket</h2>
              <button onClick={() => setShowImagePicker(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-3 border-b border-gray-100">
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={imagePickerSearch}
                onChange={e => setImagePickerSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {loadingBucketImages ? (
                <p className="text-center text-gray-400 py-8">Carregando imagens...</p>
              ) : bucketImages.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Nenhuma imagem encontrada na pasta /album</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {bucketImages
                    .filter(img => !imagePickerSearch || img.key.toLowerCase().includes(imagePickerSearch.toLowerCase()))
                    .map(img => (
                      <button
                        key={img.key}
                        type="button"
                        onClick={() => handleSelectBucketImage(img.url)}
                        className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all focus:outline-none focus:border-purple-500"
                      >
                        <img
                          src={img.url}
                          alt={img.key}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                          <p className="w-full text-white text-[10px] px-1 py-0.5 bg-black/50 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {img.key.replace('album/', '')}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 text-right">
              <button
                type="button"
                onClick={() => setShowImagePicker(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
