// [TC-CAPI 2026-06]
import { trackPixel } from '../lib/tracking.ts';
import { useEffect, useState } from 'react';
import { CheckCircle, Music, Heart, Lock } from './Icons.tsx';
import cabecaAlta from '../assets/images/Cabeça-Alta-RGB.png';

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
        const alreadyFired = sessionStorage.getItem(`tc_purchase_fired_${orderId}`);
        if (!alreadyFired) {
          // [TC-CAPI 2026-06] Purchase com advanced matching reaplicado nesta página + custom_data rico.
          const value = parseFloat(parsed?.total || lastOrder?.amount || '0');
          const childIds = (parsed?.children ?? []).map((c: any) => c.name);
          const cd = parsed?.customerData || lastOrder?.customerData || {};
          trackPixel('Purchase', {
            value, currency: 'BRL',
            content_ids: childIds,
            contents: childIds.map((id: string) => ({ id, quantity: 1 })),
            content_category: 'musica_digital',
            content_type: 'product',
            num_items: childIds.length || 1,
          }, {
            eventId: `purchase_${orderId}`,
            user: { email: cd.email ?? null, phone: cd.telefone ?? null, fullName: cd.fullName ?? null },
          });
          if ((window as any).ttq) {
            (window as any).ttq.track('CompletePayment', { value, currency: 'BRL', event_id: `purchase_${orderId}` });
          }
          sessionStorage.setItem(`tc_purchase_fired_${orderId}`, '1');
        }
      }
    } catch (e) {}

    // limpa dados de PIX após confirmação
    localStorage.removeItem('pix_payment_data');
    localStorage.removeItem('pix_payment_expiry');
  }, []);

  const isPending = status === 'pending';

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header de status */}
      <div className={`rounded-3xl p-8 text-center mb-6 ${
        isPending
          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300'
          : 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300'
      }`}>
        <div className="mb-4 flex justify-center">
          {isPending ? (
            <span className="text-6xl">⏳</span>
          ) : method === 'pix' ? (
            <span className="text-6xl">🎉</span>
          ) : (
            <img src={cabecaAlta.src} alt="Tião Camaleão" className="h-32 w-auto object-contain" />
          )}
        </div>
        <h1 className={`text-2xl font-bold mb-2 ${isPending ? 'text-yellow-800' : 'text-green-800'}`}>
          {isPending ? 'Pagamento em análise' : 'Pedido confirmado!'}
        </h1>
        <p className={`text-sm ${isPending ? 'text-yellow-700' : 'text-green-700'}`}>
          {isPending
            ? 'Seu pagamento está sendo processado. Você receberá a confirmação por e-mail em breve.'
            : 'Seu pagamento foi aprovado. Em breve você receberá o acesso ao seu álbum.'}
        </p>
      </div>

      {/* Resumo do pedido */}
      {orderData && (
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-primary to-secondary p-5 text-white">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Music className="h-5 w-5" />
              Resumo do pedido
            </h2>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Produto</p>
              <p className="font-medium text-gray-900">{orderData.productName}</p>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Dados do cliente</p>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-500">Nome:</span> <strong>{orderData.customerData.fullName}</strong></p>
                <p><span className="text-gray-500">E-mail:</span> <strong>{orderData.customerData.email}</strong></p>
                <p><span className="text-gray-500">Telefone:</span> <strong>{orderData.customerData.telefone}</strong></p>
              </div>
            </div>

            {orderData.children.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center gap-1">
                  <Heart className="h-3 w-3" /> Crianças
                </p>
                <div className="flex flex-wrap gap-2">
                  {orderData.children.map((child) => (
                    <span key={child.id} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                      {child.albumResult?.display_name ?? child.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-bold text-gray-700">Total pago</span>
              <span className="text-2xl font-bold text-primary">
                R$ {parseFloat(orderData.total).toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Forma de pagamento */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <span className="text-2xl">{method === 'pix' ? '⚡' : '💳'}</span>
        <div>
          <p className="font-medium text-gray-800 text-sm">
            Pago via {method === 'pix' ? 'PIX' : 'Cartão de crédito'}
          </p>
          <p className="text-xs text-gray-500">Processado com segurança pelo Mercado Pago</p>
        </div>
      </div>

      {/* Próximos passos */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200 mb-6">
        <h3 className="font-bold text-blue-900 mb-3">📬 Próximos passos</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>Você receberá um e-mail de confirmação em <strong>{orderData?.customerData.email}</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>Seu álbum personalizado será preparado e enviado por e-mail</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span>Em caso de dúvidas, entre em contato pelo nosso suporte</span>
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-center gap-2 text-green-600">
        <Lock className="h-4 w-4" />
        <span className="text-sm">Compra 100% segura e protegida</span>
      </div>
    </div>
  );
}
