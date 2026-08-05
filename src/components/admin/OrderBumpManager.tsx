import { useEffect, useState } from 'react';

interface OrderBump {
  id: string;
  title: string;
  description: string;
  originalPrice: number;
  offerPrice: number;
  icon: string;
  badge: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface FormData {
  title: string;
  description: string;
  originalPrice: string;
  offerPrice: string;
  icon: string;
  badge: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  originalPrice: '',
  offerPrice: '',
  icon: 'gift',
  badge: '',
  imageUrl: '',
  isActive: true,
  sortOrder: '0',
};

const ICON_OPTIONS = [
  { value: 'gift', label: '🎁 Gift' },
  { value: 'zap', label: '⚡ Zap' },
  { value: 'trending', label: '📈 Trending' },
  { value: 'music', label: '🎵 Música' },
  { value: 'star', label: '⭐ Estrela' },
  { value: 'heart', label: '❤️ Coração' },
];

interface Props {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const API_URL = import.meta.env.PUBLIC_API_URL;

export default function OrderBumpManager({ authenticatedFetch }: Props) {
  const [bumps, setBumps] = useState<OrderBump[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  async function fetchBumps() {
    try {
      const res = await fetch(`${API_URL}/api/orderbumps`);
      const json = await res.json();
      if (json.success) {
        setBumps(json.data.map((b: OrderBump) => ({
          ...b,
          originalPrice: Number(b.originalPrice),
          offerPrice: Number(b.offerPrice),
        })));
      }
    } catch (e) {
      console.error('Erro ao buscar order bumps:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchBumps(); }, []);

  function openCreate() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEdit(bump: OrderBump) {
    setEditingId(bump.id);
    setFormData({
      title: bump.title,
      description: bump.description,
      originalPrice: String(bump.originalPrice),
      offerPrice: String(bump.offerPrice),
      icon: bump.icon || 'gift',
      badge: bump.badge || '',
      imageUrl: bump.imageUrl || '',
      isActive: bump.isActive,
      sortOrder: String(bump.sortOrder),
    });
    setFormError('');
    setIsModalOpen(true);
  }

  async function handleSave() {
    setFormError('');
    const original = parseFloat(formData.originalPrice);
    const offer = parseFloat(formData.offerPrice);
    if (!formData.title.trim()) { setFormError('Título obrigatório'); return; }
    if (!formData.description.trim()) { setFormError('Descrição obrigatória'); return; }
    if (isNaN(original) || original <= 0) { setFormError('Preço original inválido'); return; }
    if (isNaN(offer) || offer <= 0) { setFormError('Preço da oferta inválido'); return; }
    if (offer >= original) { setFormError('Preço da oferta deve ser menor que o preço original'); return; }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        originalPrice: original,
        offerPrice: offer,
        icon: formData.icon,
        badge: formData.badge.trim() || null,
        imageUrl: formData.imageUrl.trim() || null,
        isActive: formData.isActive,
        sortOrder: parseInt(formData.sortOrder) || 0,
      };

      const url = editingId
        ? `${API_URL}/api/orderbumps/${editingId}`
        : `${API_URL}/api/orderbumps`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) { setFormError(json.message || 'Erro ao salvar'); return; }

      await fetchBumps();
      setIsModalOpen(false);
    } catch (e) {
      setFormError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/orderbumps/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) await fetchBumps();
    } catch (e) {
      console.error('Erro ao deletar:', e);
    } finally {
      setDeletingId(null);
    }
  }

  const savings = (b: OrderBump) => b.originalPrice - b.offerPrice;
  const savingsPct = (b: OrderBump) => Math.round((savings(b) / b.originalPrice) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Order Bumps</h2>
          <p className="text-sm text-gray-500 mt-0.5">Ofertas exibidas na página de pagamento</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + Novo Order Bump
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
      ) : bumps.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-500 text-sm">Nenhum order bump cadastrado ainda.</p>
          <button onClick={openCreate} className="mt-3 text-primary text-sm font-medium hover:underline">
            Criar primeiro order bump
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {bumps.map((bump) => (
            <div key={bump.id} className={`bg-white rounded-2xl border-2 p-5 transition-all ${bump.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl flex-shrink-0">
                  {bump.icon === 'gift' ? '🎁' : bump.icon === 'zap' ? '⚡' : bump.icon === 'trending' ? '📈' : bump.icon === 'music' ? '🎵' : bump.icon === 'star' ? '⭐' : '❤️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 text-sm">{bump.title}</h3>
                    {bump.badge && (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">{bump.badge}</span>
                    )}
                    {!bump.isActive && (
                      <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Inativo</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{bump.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400 line-through">R$ {bump.originalPrice.toFixed(2)}</span>
                    <span className="text-sm font-bold text-green-600">R$ {bump.offerPrice.toFixed(2)}</span>
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">-{savingsPct(bump)}%</span>
                    <span className="text-xs text-gray-400">Ordem: {bump.sortOrder}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(bump)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(bump.id)}
                    disabled={deletingId === bump.id}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingId === bump.id ? '...' : 'Deletar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criar/editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Editar Order Bump' : 'Novo Order Bump'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: 🎵 CD Físico Personalizado"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Descrição *</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Descreva o produto ou serviço..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Preço Original (R$) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formData.originalPrice}
                    onChange={e => setFormData(p => ({ ...p, originalPrice: e.target.value }))}
                    placeholder="97.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Preço da Oferta (R$) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formData.offerPrice}
                    onChange={e => setFormData(p => ({ ...p, offerPrice: e.target.value }))}
                    placeholder="47.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ícone</label>
                  <select
                    value={formData.icon}
                    onChange={e => setFormData(p => ({ ...p, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  >
                    {ICON_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Badge (ex: "Mais Vendido")</label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={e => setFormData(p => ({ ...p, badge: e.target.value }))}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ordem de exibição</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.sortOrder}
                    onChange={e => setFormData(p => ({ ...p, sortOrder: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-sm text-gray-700">Ativo</span>
                  </label>
                </div>
              </div>

              {formError && (
                <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar order bump'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
