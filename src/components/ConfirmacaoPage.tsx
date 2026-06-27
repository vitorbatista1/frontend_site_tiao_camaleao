// [TC-CAPI 2026-06] - REDESENHADO COM LOGO ANIMADO
import { trackBoth, normalizePhoneBR } from '../lib/tracking.ts';
import { useEffect, useState } from 'react';
import { CheckCircle, Music, Heart, Lock } from './Icons.tsx';
import cabecaAlta from '../assets/images/Cabeça-Alta-RGB.png';

interface GravacaoItem {
  albumId: string;
  name: string;
  price: number;
}

interface OrderData {
  customerData: {
    fullName: string;
    email: string;
    telefone: string;
  };
  children: Array<{
    id: string;
    name: string;
    selectedAlbums?: string[];
    albumResult?: { display_name?: string };
  }>;
  gravacaoItems?: GravacaoItem[];
  productName: string;
  total: string;
}

export default function ConfirmacaoPage() {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [method, setMethod] = useState<string>('');
  const [status, setStatus] = useState<string>('approved');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMethod(params.get('method') || 'pix');
    setStatus(params.get('status') || 'approved');

    const saved = localStorage.getItem('orderData');
    const parsed = saved ? JSON.parse(saved) : null;
    if (parsed) setOrderData(parsed);

    try {
      const lastOrderRaw = localStorage.getItem('tc_last_order');
      const lastOrder = lastOrderRaw ? JSON.parse(lastOrderRaw) : null;
      const queryOrderId = params.get('order_id') || params.get('ref');
      const currentStatus = params.get('status') || 'approved';
      const orderId = lastOrder?.order_id || queryOrderId;

      if (currentStatus === 'approved' && orderId) {
        const alreadyFired = localStorage.getItem(`tc_purchase_fired_${orderId}`);
        if (!alreadyFired) {
          const value = parseFloat(parsed?.total || lastOrder?.amount || '0');
          const cd = parsed?.customerData || lastOrder?.customerData || {};

          const allItems: Array<{ id: string; quantity: number; item_price: number }> = [];
          (parsed?.children ?? []).forEach((c: any) => {
            (c.selectedAlbums ?? []).forEach((albumId: string) => {
              allItems.push({ id: albumId, quantity: 1, item_price: 0 });
            });
          });
          (parsed?.gravacaoItems ?? []).forEach((g: any) => {
            allItems.push({ id: g.albumId ?? g.name, quantity: 1, item_price: Number(g.price ?? 0) });
          });
          const childIds = allItems.length > 0
            ? allItems.map(i => i.id)
            : (parsed?.children ?? []).map((c: any) => c.name);
          const purchaseEventId = `Purchase_BWS_${orderId}`;
          const nameParts = (cd.fullName ?? '').trim().split(/\s+/);

          trackBoth('Purchase', {
            event_name: 'Purchase',
            event_id: purchaseEventId,
            value,
            content_ids: childIds.length ? childIds : undefined,
            contents: allItems.length
              ? allItems
              : childIds.map((id: string) => ({ id, quantity: 1, item_price: value / (childIds.length || 1) })),
            num_items: childIds.length || 1,
            em: cd.email ?? null,
            ph: cd.telefone ?? null,
            fn: nameParts[0] ?? null,
            ln: nameParts.slice(1).join(' ') || null,
          }, { email: cd.email ?? null, phone: cd.telefone ?? null, fullName: cd.fullName ?? null });

          localStorage.setItem(`tc_purchase_fired_${orderId}`, '1');
        }
      }
    } catch (e) {}

    localStorage.removeItem('pix_payment_data');
    localStorage.removeItem('pix_payment_expiry');
  }, []);

  const isPending = status === 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        


        {/* ===== STATUS CARD COM LOGO ANIMADO ===== */}
        <div className={`rounded-3xl p-8 text-center mb-8 transform transition-all duration-500 ${
          isPending
            ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 shadow-lg'
            : 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-2 border-emerald-300 shadow-xl'
        }`}>
          <div className="mb-4 flex justify-center">
            {isPending ? (
              <span className="text-6xl animate-pulse">⏳</span>
            ) : (
              <img 
                src={cabecaAlta.src} 
                alt="Sucesso" 
                className="h-24 w-auto object-contain animate-bounce" 
              />
            )}
          </div>
          <h1 className={`text-3xl font-black mb-3 ${isPending ? 'text-amber-900' : 'text-emerald-900'}`}>
            {isPending ? 'Pagamento em análise' : 'Pedido confirmado!'}
          </h1>
          <p className={`text-base leading-relaxed ${isPending ? 'text-amber-800' : 'text-emerald-800'}`}>
            {isPending
              ? 'Seu pagamento está sendo processado. Você receberá a confirmação por e-mail em breve.'
              : 'Seu pagamento foi aprovado com sucesso! Acesse suas compras agora mesmo.'}
          </p>
        </div>

        {/* ===== BOTÃO PRINCIPAL - DESTAQUE MÁXIMO ===== */}
        <div className="mb-8">
          <a
            href="https://meu.tiaocamaleao.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block"
            style={{
              perspective: '1000px',
            }}
          >
            {/* Efeito de brilho de fundo */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
            
            {/* Card principal */}
            <div className="relative bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 rounded-3xl p-8 shadow-2xl overflow-hidden group-hover:shadow-3xl transition-all duration-300 transform group-hover:scale-105">
              
              {/* Padrão de fundo animado */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full mix-blend-overlay blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full mix-blend-overlay blur-3xl"></div>
              </div>

              <div className="relative z-10">
                {/* Etiqueta superior */}
                <div className="inline-block mb-4 px-4 py-2 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-white">
                    🎵 Acesso imediato
                  </p>
                </div>

                {/* Título principal */}
                <h2 className="text-4xl font-black text-white mb-2 leading-tight">
                  Clique aqui para acessar suas compras
                </h2>

                {/* Descrição */}
                <p className="text-white text-opacity-90 text-base mb-6 leading-relaxed">
                  Acesse sua biblioteca de áudios personalizados agora mesmo
                </p>

                {/* Passo a passo compacto */}
                <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white border-opacity-20">
                  <p className="text-xs font-bold text-white uppercase mb-3 tracking-wide">3 passos rápidos:</p>
                  <div className="space-y-2">
                    {[
                      { num: '1', text: 'Clique no botão' },
                      { num: '2', text: `Digite seu telefone` },
                      { num: '3', text: 'Ouça sua compra!' },
                    ].map((step) => (
                      <div key={step.num} className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white bg-opacity-30 flex items-center justify-center text-white font-bold text-xs">
                          {step.num}
                        </span>
                        <span className="text-sm text-white text-opacity-90">{step.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => window.open('https://meu.tiaocamaleao.com.br/', '_blank')}
                  className="w-full bg-white text-emerald-700 font-black text-lg py-4 px-6 rounded-2xl transition-all duration-300 transform group-hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <span>👉 Acessar minhas compras</span>
                  <span className="text-xl">→</span>
                </button>

                {/* URL de referência */}
                <p className="text-center text-xs text-white text-opacity-75 mt-3 font-medium">
                  meu.tiaocamaleao.com.br
                </p>
              </div>
            </div>
          </a>

          {/* Aviso de cadastro - fora do botão */}
          <div className="mt-4 mx-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <p className="text-xs font-semibold text-blue-900 mb-1">ℹ️ Primeira vez?</p>
            <p className="text-xs text-blue-800 leading-relaxed">
              Será solicitado nome e telefone (leva menos de 1 minuto e é necessário apenas uma vez para a nota fiscal).
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
