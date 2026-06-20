import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CardForm from './CardForm.tsx';
import { ArrowLeft, Lock, CheckCircle, Music, Heart, Zap, Gift, TrendingUp, X } from './Icons.tsx';
import { fbqTrack, ttqTrack, getSessionId, trackCapi } from '../lib/tracking.ts';

interface GravacaoItem {
  albumId: string;
  childName: string;
  name: string;
  price: number;
}

interface OrderData {
  customerData: {
    fullName: string;
    email: string;
    telefone: string;
    cpf?: string;
  };
  children: Array<{
    id: string;
    name: string;
    selectedAlbums?: string[];
    albumResult?: { display_name?: string };
  }>;
  useCustomName: boolean;
  productName: string;
  productPrice: string;
  total: string;
  gravacaoItems?: GravacaoItem[];
}

interface OrderBump {
  id: string;
  title: string;
  description: string;
  originalPrice: number;
  offerPrice: number;
  icon: string;
  badge: string | null;
  popularText?: string;
}

interface AlbumOrderBump {
  id: string;
  name: string;
  linkImgAlbum: string;
  priceOld: number | null;
  priceNew: number;
  orderBumpDiscount: number;
}

interface AlbumBumpSuggestion {
  childName: string;
  albums: AlbumOrderBump[];
}

// Key to uniquely identify a (childName, albumId) selection
type AlbumBumpKey = string; // `${childName}::${albumId}`

const OrderBumpItem = React.memo(({
  bump,
  isSelected,
  onSelect
}: {
  bump: OrderBump;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}) => {
  const savings = bump.originalPrice - bump.offerPrice;
  const savingsPercent = Math.round((savings / bump.originalPrice) * 100);

  const getIcon = () => {
    switch (bump.icon) {
      case 'zap': return <Zap className="h-8 w-8 text-yellow-500" />;
      case 'gift': return <Gift className="h-8 w-8 text-pink-500" />;
      case 'trending': return <TrendingUp className="h-8 w-8 text-green-500" />;
      case 'music': return <Music className="h-8 w-8 text-purple-500" />;
      case 'heart': return <Heart className="h-8 w-8 text-red-500" />;
      case 'star': return <span className="text-3xl">⭐</span>;
      default: return <Gift className="h-8 w-8 text-pink-500" />;
    }
  };

  return (
    <div
      className={`relative rounded-2xl p-5 cursor-pointer transition-all duration-300 ${
        isSelected
          ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 shadow-lg scale-[1.02]'
          : 'bg-white border-2 border-gray-200 hover:border-yellow-300 hover:shadow-md'
      }`}
      onClick={() => onSelect(!isSelected)}
    >
      <div className="absolute -top-3 -right-3 z-10">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse shadow-lg">
          🔥 -{savingsPercent}% OFF
        </div>
      </div>

      {(bump.popularText || bump.badge) && (
        <div className="absolute -top-3 -left-3 z-10">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            ⭐ {bump.popularText || bump.badge}
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center transition-all ${
          isSelected ? 'bg-yellow-100 scale-110' : 'bg-gray-50'
        }`}>
          {getIcon()}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-bold text-lg text-gray-900">{bump.title}</h3>
            {isSelected && <CheckCircle className="h-5 w-5 text-green-500 animate-bounce" />}
          </div>
          <p className="text-gray-600 text-sm mb-3">{bump.description}</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-gray-400 line-through text-sm">
              R$ {bump.originalPrice.toFixed(2)}
            </span>
            <span className="text-2xl font-bold text-green-600">
              R$ {bump.offerPrice.toFixed(2)}
            </span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
              Economize R$ {savings.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected ? 'bg-green-500 border-green-500 shadow-md' : 'border-gray-400 bg-white'
          }`}>
            {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
          </div>
        </div>
      </div>
    </div>
  );
});

// const UpsellModal = React.memo(({ onClose, onViewBumps }: { onClose: () => void; onViewBumps: () => void }) => (
//   <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
//     <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
//       <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
//         <X className="h-5 w-5" />
//       </button>
//       <div className="text-center">
//         <div className="text-7xl mb-4 animate-bounce">🎁</div>
//         <h3 className="text-2xl font-bold mb-2 text-gray-900">Espere! Você vai perder isso!</h3>
//         <p className="text-gray-600 mb-4">
//           Outros clientes economizaram em média{' '}
//           <span className="font-bold text-green-600 text-lg">R$ 87,00</span> adicionando esses bônus!
//         </p>
//         <div className="bg-yellow-50 rounded-xl p-3 mb-4">
//           <p className="text-sm text-yellow-800">
//             ⚡ <span className="font-bold">OFERTA POR TEMPO LIMITADO</span> ⚡
//           </p>
//         </div>
//         <div className="flex gap-3">
//           <button
//             onClick={onClose}
//             className="flex-1 border-2 border-gray-300 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
//           >
//             Não, obrigado
//           </button>
//           <button
//             onClick={onViewBumps}
//             className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all duration-300"
//           >
//             Ver bônus agora 🎁
//           </button>
//         </div>
//       </div>
//     </div>
//   </div>
// ));

const MemoizedCardForm = React.memo(({
  amount,
  email,
  customerName,
  telefone,
  cpf,
  selectedAlbums,
}: {
  amount: string;
  email: string;
  customerName: string;
  telefone?: string;
  cpf?: string;
  selectedAlbums?: { albumId: string; childName: string }[];
}) => (
  <CardForm
    step={3}
    amount={amount}
    publicKey={import.meta.env.PUBLIC_MP_PUBLIC_KEY || ''}
    email={email}
    customerName={customerName}
    telefone={telefone}
    cpf={cpf}
    selectedAlbums={selectedAlbums}
  />
));

const API_URL = import.meta.env.PUBLIC_API_URL;

export default function PaymentPage() {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [showBumpModal, setShowBumpModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [bumps, setBumps] = useState<OrderBump[]>([]);
  const [albumBumpSuggestions, setAlbumBumpSuggestions] = useState<AlbumBumpSuggestion[]>([]);
  const [selectedAlbumBumps, setSelectedAlbumBumps] = useState<Set<AlbumBumpKey>>(new Set());

  useEffect(() => {
    const savedData = localStorage.getItem('orderData');
    let parsed: OrderData | null = null;
    if (savedData) {
      parsed = JSON.parse(savedData);
      setOrderData(parsed);
    }

    fetch(`${API_URL}/api/orderbumps?active=true`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setBumps(json.data.map((b: OrderBump) => ({
            ...b,
            originalPrice: Number(b.originalPrice),
            offerPrice: Number(b.offerPrice),
            popularText: b.badge ?? '',
          })));
        }
      })
      .catch(() => {});

    if (parsed) {
      // Combo já contempla todos os álbuns — excluir filhos com combo das sugestões de album bump
      const albumsAPI: Array<{ id: string; tipo: string }> = (parsed as any).albumsAPI ?? [];
      const comboIds = new Set(albumsAPI.filter(a => a.tipo === 'COMBO').map(a => a.id));

      const cartItems = parsed.children.flatMap((child) =>
        (child.selectedAlbums ?? [])
          .filter(albumId => !comboIds.has(albumId))
          .map((albumId) => ({
            albumId,
            childName: child.albumResult?.display_name ?? child.name,
          }))
      );
      if (cartItems.length > 0) {
        fetch(`${API_URL}/api/albums/suggest-order-bumps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartItems }),
        })
          .then(r => r.json())
          .then(json => {
            if (json.success) {
              setAlbumBumpSuggestions(
                json.data.map((s: AlbumBumpSuggestion) => ({
                  ...s,
                  albums: s.albums.map((a: AlbumOrderBump) => ({
                    ...a,
                    priceOld: a.priceOld != null ? Number(a.priceOld) : null,
                    priceNew: Number(a.priceNew),
                  })),
                }))
              );
            }
          })
          .catch(() => {});
      }
    }

    setIsLoading(false);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showSuccessAlert) {
      const timer = setTimeout(() => setShowSuccessAlert(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessAlert]);

  const handleBack = useCallback(() => { window.location.href = '/'; }, []);

  const calculateTotalWithBumps = useMemo(() => {
    const baseTotal = parseFloat(orderData?.total || '0');
    const bumpsTotal = selectedBumps.reduce((total, bumpId) => {
      const bump = bumps.find(b => b.id === bumpId);
      return total + (bump?.offerPrice || 0);
    }, 0);
    const albumBumpsTotal = Array.from(selectedAlbumBumps).reduce((total, key) => {
      const [childName, albumId] = key.split('::');
      const suggestion = albumBumpSuggestions.find(s => s.childName === childName);
      const album = suggestion?.albums.find(a => a.id === albumId);
      if (!album) return total;
      const offerPrice = album.orderBumpDiscount > 0
        ? album.priceNew * (1 - album.orderBumpDiscount / 100)
        : album.priceNew;
      return total + offerPrice;
    }, 0);
    return baseTotal + bumpsTotal + albumBumpsTotal;
  }, [orderData, selectedBumps, selectedAlbumBumps, albumBumpSuggestions]);

  const calculateSavings = useMemo(() => {
    const bumpSavings = selectedBumps.reduce((total, bumpId) => {
      const bump = bumps.find(b => b.id === bumpId);
      return total + ((bump?.originalPrice || 0) - (bump?.offerPrice || 0));
    }, 0);
    const albumBumpSavings = Array.from(selectedAlbumBumps).reduce((total, key) => {
      const [childName, albumId] = key.split('::');
      const suggestion = albumBumpSuggestions.find(s => s.childName === childName);
      const album = suggestion?.albums.find(a => a.id === albumId);
      if (!album) return total;
      const offerPrice = album.orderBumpDiscount > 0
        ? album.priceNew * (1 - album.orderBumpDiscount / 100)
        : album.priceNew;
      const basePrice = album.priceOld ?? album.priceNew;
      return total + (basePrice - offerPrice);
    }, 0);
    return bumpSavings + albumBumpSavings;
  }, [selectedBumps, bumps, selectedAlbumBumps, albumBumpSuggestions]);

  const formatTime = useCallback(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  const handleAddBump = useCallback((bumpId: string, selected: boolean) => {
    if (selected) {
      setSelectedBumps(prev => [...prev, bumpId]);
      setShowSuccessAlert(true);
    } else {
      setSelectedBumps(prev => prev.filter(id => id !== bumpId));
    }
  }, []);

  const handleToggleAlbumBump = useCallback((childName: string, albumId: string, selected: boolean) => {
    const key: AlbumBumpKey = `${childName}::${albumId}`;
    setSelectedAlbumBumps(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(key);
        setShowSuccessAlert(true);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handlePaymentClick = useCallback(() => {
    if (!sessionStorage.getItem('tc_api_fired')) {
      const apiEventId = `api_${getSessionId()}_${Date.now()}`;
      fbqTrack('AddPaymentInfo', { value: calculateTotalWithBumps, currency: 'BRL' }, { eventID: apiEventId });
      ttqTrack('AddPaymentInfo', { value: calculateTotalWithBumps, currency: 'BRL' }, { event_id: apiEventId });
      // [TC-CAPI 2026-06] espelho CAPI do AddPaymentInfo. Aqui já temos email/telefone.
      trackCapi({
        event_name: 'AddPaymentInfo',
        event_id: apiEventId,
        value: calculateTotalWithBumps,
        currency: 'BRL',
        em: orderData?.customerData?.email ?? null,
        ph: orderData?.customerData?.telefone ?? null,
      });
      sessionStorage.setItem('tc_api_fired', '1');
    }
    if (selectedBumps.length === 0 && selectedAlbumBumps.size === 0) setShowBumpModal(true);
  }, [selectedBumps.length, selectedAlbumBumps.size, calculateTotalWithBumps]);

  const handleViewBumps = useCallback(() => {
    setShowBumpModal(false);
    document.getElementById('order-bumps')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const formattedAmount = useMemo(() => {
    return `R$ ${calculateTotalWithBumps.toFixed(2).replace('.', ',')}`;
  }, [calculateTotalWithBumps]);

  // Monta selectedAlbums para o CardForm: itens do carrinho + gravação + álbuns bumps selecionados
  const selectedAlbumsForPayment = useMemo(() => {
    if (!orderData) return [];
    const baseItems = orderData.children.flatMap((child) =>
      (child.selectedAlbums ?? []).map((albumId) => ({
        albumId,
        childName: child.albumResult?.display_name ?? child.name,
      }))
    );
    const gravItems = (orderData.gravacaoItems ?? []).map((item) => ({
      albumId: item.albumId,
      childName: item.childName,
      name: item.name,
      price: item.price,
    }));
    const bumpItems = Array.from(selectedAlbumBumps).map(key => {
      const [childName, albumId] = key.split('::');
      return { albumId, childName };
    });
    return [...baseItems, ...gravItems, ...bumpItems];
  }, [orderData, selectedAlbumBumps]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="text-center py-12 max-w-md mx-auto px-4">
        <div className="bg-yellow-50 rounded-2xl p-8 border-2 border-yellow-200">
          <Music className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum pedido encontrado</h2>
          <p className="text-gray-600 mb-6">Parece que você não tem nenhum pedido em andamento.</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar para a loja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors group"
      >
        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
        Voltar
      </button>
{/* 
      {showBumpModal && (
        <UpsellModal
          onClose={() => setShowBumpModal(false)}
          onViewBumps={handleViewBumps}
        />
      )} */}

      {/* Alert de sucesso */}
      {showSuccessAlert && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-top-2">
          ✅ Bônus adicionado!
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Coluna esquerda */}
        <div className="space-y-6">
          {/* Order Bumps */}
          {(bumps.length > 0 || albumBumpSuggestions.length > 0) && <div id="order-bumps" className="scroll-mt-4">
            {timeLeft > 0 && (
              <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-t-2xl p-3 text-white text-center animate-pulse">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5 animate-pulse" />
                  <span className="font-bold">⚡ OFERTA RELÂMPAGO - EXPIRA EM:</span>
                  <span className="font-mono bg-white/20 px-3 py-1 rounded-lg font-bold text-lg">
                    {formatTime()}
                  </span>
                </div>
              </div>
            )}

            <div className={`bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400 ${
              timeLeft > 0 ? 'rounded-t-none' : 'rounded-t-2xl'
            } rounded-b-2xl p-6`}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-400 px-5 py-2 rounded-full text-white text-sm font-bold mb-4 shadow-lg">
                  🎁 SÓ HOJE 🎁
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">
                  Complete seu Kit com esses{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                    SUPER BÔNUS
                  </span>
                </h3>
                <p className="text-gray-600">
                  Adicione agora e ganhe <span className="font-bold text-green-600 text-lg">50% OFF</span>
                </p>
              </div>

              <div className="space-y-4">
                {bumps.map((bump) => (
                  <OrderBumpItem
                    key={bump.id}
                    bump={bump}
                    isSelected={selectedBumps.includes(bump.id)}
                    onSelect={(selected) => handleAddBump(bump.id, selected)}
                  />
                ))}
              </div>

              {/* Álbuns Order Bump por pessoa */}
              {albumBumpSuggestions.length > 0 && (
                <div className="mt-4 space-y-4">
                  <div className="border-t border-yellow-300 pt-4">
                    <p className="text-center text-sm font-bold text-gray-700 mb-3">
                      🎵 Álbuns complementares para seus filhos
                    </p>
                    {albumBumpSuggestions.map((suggestion) =>
                      suggestion.albums.map((album) => {
                        const key: AlbumBumpKey = `${suggestion.childName}::${album.id}`;
                        const isSelected = selectedAlbumBumps.has(key);
                        const offerPrice = album.orderBumpDiscount > 0
                          ? album.priceNew * (1 - album.orderBumpDiscount / 100)
                          : album.priceNew;
                        const basePrice = album.priceOld ?? album.priceNew;
                        const savingsPct = album.orderBumpDiscount > 0
                          ? album.orderBumpDiscount
                          : album.priceOld
                            ? Math.round(((album.priceOld - album.priceNew) / album.priceOld) * 100)
                            : null;
                        return (
                          <div
                            key={key}
                            className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-300 ${
                              isSelected
                                ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 shadow-lg scale-[1.02]'
                                : 'bg-white border-2 border-gray-200 hover:border-yellow-300 hover:shadow-md'
                            }`}
                            onClick={() => handleToggleAlbumBump(suggestion.childName, album.id, !isSelected)}
                          >
                            {savingsPct !== null && (
                              <div className="absolute -top-3 -right-3 z-10">
                                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse shadow-lg">
                                  🔥 -{savingsPct}% OFF
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              {album.linkImgAlbum && (
                                <img
                                  src={album.linkImgAlbum}
                                  alt={album.name}
                                  className={`w-16 h-16 rounded-xl object-cover flex-shrink-0 transition-transform ${isSelected ? 'scale-110' : ''}`}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                    Para {suggestion.childName}
                                  </span>
                                  {isSelected && <CheckCircle className="h-4 w-4 text-green-500" />}
                                </div>
                                <p className="font-bold text-gray-900 text-sm truncate">{album.name}</p>
                                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                                  {offerPrice < basePrice && (
                                    <span className="text-gray-400 line-through text-xs">
                                      R$ {basePrice.toFixed(2)}
                                    </span>
                                  )}
                                  <span className="text-lg font-bold text-green-600">
                                    R$ {offerPrice.toFixed(2)}
                                  </span>
                                  {offerPrice < basePrice && (
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                      Economize R$ {(basePrice - offerPrice).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected ? 'bg-green-500 border-green-500 shadow-md' : 'border-gray-400 bg-white'
                                }`}>
                                  {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {(selectedBumps.length > 0 || selectedAlbumBumps.size > 0) && (
                <div className="mt-4 bg-gradient-to-r from-green-100 to-emerald-100 border-l-4 border-green-500 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <p className="font-bold text-green-800">
                      🎉 Você economizou R$ {calculateSavings.toFixed(2)}!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>}

          {/* Resumo do Pedido */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden sticky top-6">
            <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white">
              <h2 className="text-2xl font-bold flex items-center gap-2">🎵 Resumo do Pedido</h2>
              <p className="text-white/90 mt-1">Revise os dados antes de finalizar</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Produto</h3>
                <p className="text-gray-900 font-medium">{orderData.productName}</p>
              </div>

              <div className="border-b border-gray-100 pb-4">
                <h3 className="font-semibold text-gray-700 mb-2">👤 Dados do Cliente</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Nome:</span> <span className="font-medium">{orderData.customerData.fullName}</span></p>
                  <p><span className="text-gray-500">E-mail:</span> <span className="font-medium">{orderData.customerData.email}</span></p>
                  <p><span className="text-gray-500">Telefone:</span> <span className="font-medium">{orderData.customerData.telefone}</span></p>
                </div>
              </div>

              <div className="border-b border-gray-100 pb-4">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4" /> Crianças
                </h3>
                <div className="flex flex-wrap gap-2">
                  {orderData.children.map((child) => (
                    <span key={child.id} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                      {child.name}
                    </span>
                  ))}
                </div>
                {/* Álbuns selecionados por criança */}
                {(orderData.children.some(c => (c.selectedAlbums ?? []).length > 0) || (orderData.gravacaoItems ?? []).length > 0) && (
                  <div className="mt-2 space-y-1">
                    {orderData.children.map((child) => {
                      const childDisplay = child.albumResult?.display_name ?? child.name;
                      const digitalAlbums = child.selectedAlbums ?? [];
                      const gravItems = (orderData.gravacaoItems ?? []).filter(g => g.childName === childDisplay);
                      if (!digitalAlbums.length && !gravItems.length) return null;
                      const allNames = [
                        ...digitalAlbums.map(id => id),
                        ...gravItems.map(g => `${g.name} (R$ ${g.price.toFixed(2).replace('.', ',')})`),
                      ];
                      return (
                        <p key={child.id} className="text-xs text-gray-500">
                          <span className="font-medium">{childDisplay}:</span>{' '}
                          {allNames.join(', ')}
                        </p>
                      );
                    })}
                  </div>
                )}
                {orderData.useCustomName && (
                  <p className="text-xs text-primary mt-2">✨ Inclui nome personalizado (+ R$ 30,00)</p>
                )}
              </div>

              {(selectedBumps.length > 0 || selectedAlbumBumps.size > 0) && (
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">🎁 Bônus adicionados</h3>
                  <div className="space-y-1">
                    {selectedBumps.map(bumpId => {
                      const bump = bumps.find(b => b.id === bumpId);
                      return (
                        <div key={bumpId} className="flex justify-between text-sm">
                          <span>{bump?.title}</span>
                          <span className="text-green-600 font-bold">+ R$ {bump?.offerPrice.toFixed(2)}</span>
                        </div>
                      );
                    })}
                    {Array.from(selectedAlbumBumps).map(key => {
                      const [childName, albumId] = key.split('::');
                      const suggestion = albumBumpSuggestions.find(s => s.childName === childName);
                      const album = suggestion?.albums.find(a => a.id === albumId);
                      if (!album) return null;
                      const offerPrice = album.orderBumpDiscount > 0
                        ? album.priceNew * (1 - album.orderBumpDiscount / 100)
                        : album.priceNew;
                      return (
                        <div key={key} className="flex justify-between text-sm">
                          <span>{album.name} <span className="text-purple-600 text-xs">(para {childName})</span></span>
                          <span className="text-green-600 font-bold">+ R$ {offerPrice.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-700">Total:</span>
                  <span className="text-3xl font-bold text-primary">
                    R$ {calculateTotalWithBumps.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Em até 12x no cartão</p>
              </div>

              <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-xl p-3">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Compra 100% segura</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita - Pagamento */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
              <h2 className="text-2xl font-bold">💳 Pagamento</h2>
              <p className="text-white/90 mt-1">Escolha a forma de pagamento</p>
            </div>

            <div className="p-6" onClick={handlePaymentClick}>
              <MemoizedCardForm
                amount={formattedAmount}
                email={orderData.customerData.email}
                customerName={orderData.customerData.fullName}
                telefone={orderData.customerData.telefone}
                cpf={orderData.customerData.cpf ?? ""}
                selectedAlbums={selectedAlbumsForPayment}
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900">Garantia de satisfação</p>
                <p className="text-sm text-gray-600 mt-1">
                  Se não ficar satisfeito, devolvemos 100% do seu dinheiro em até 7 dias.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}