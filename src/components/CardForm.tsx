import { useEffect, useState, useRef } from 'react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { CreditCard, QrCode, Lock } from './Icons.tsx';
import { getTrackingPayload } from '../lib/tracking.ts';


type CardFormProps = {
  step: number;
  amount: string;
  publicKey: string;
  email: string;
  customerName?: string;
  telefone?: string;
  cpf?: string;
  selectedAlbums?: { albumId: string; childName: string; name?: string; price?: number; tipo?: string; misto?: boolean; isOrderBump?: boolean; isRelampago?: boolean }[];
  // [CHECKOUT-LINK 2026-08] id do CheckoutDraft de origem (link gerado por
  // outro sistema) — repassado ao backend pra marcar o link como usado
  // quando o pagamento for aprovado.
  checkoutDraftId?: string;
};

interface PixData {
  payment_id: number;
  external_reference: string;
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
  expires_at: string;
  amount: number;
}

const API_URL = import.meta.env.PUBLIC_API_URL;
const PIX_STORAGE_KEY = "pix_payment_data";
const PIX_EXPIRY_KEY = "pix_payment_expiry";

// status_detail que o Mercado Pago devolve pra pagamentos recusados/pendentes
// de cartão — texto cru tipo "cc_rejected_high_risk" não deve chegar ao cliente.
const CARD_STATUS_DETAIL_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Número do cartão inválido. Confira e tente novamente.",
  cc_rejected_bad_filled_date: "Data de validade inválida. Confira e tente novamente.",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido. Confira e tente novamente.",
  cc_rejected_bad_filled_other: "Dados do cartão inválidos. Confira e tente novamente.",
  cc_rejected_blacklist: "Cartão recusado pela operadora. Tente outro cartão.",
  cc_rejected_call_for_authorize: "Seu banco precisa autorizar esse pagamento. Ligue pro seu banco ou tente outro cartão.",
  cc_rejected_card_disabled: "Cartão desabilitado. Ligue pro seu banco pra ativar ou tente outro cartão.",
  cc_rejected_card_error: "Não conseguimos processar o pagamento com esse cartão. Tente novamente ou use outro cartão.",
  cc_rejected_duplicated_payment: "Já existe um pagamento igual em andamento. Aguarde alguns minutos antes de tentar de novo.",
  cc_rejected_high_risk: "Pagamento recusado por segurança. Tente com outro cartão ou use o PIX.",
  cc_rejected_insufficient_amount: "Saldo ou limite insuficiente no cartão.",
  cc_rejected_invalid_installments: "Esse cartão não aceita o número de parcelas escolhido. Tente com menos parcelas.",
  cc_rejected_max_attempts: "Limite de tentativas atingido. Tente novamente mais tarde ou use outro cartão.",
  cc_rejected_other_reason: "Pagamento recusado pela operadora. Tente outro cartão ou use o PIX.",
};

function friendlyCardErrorMessage(statusDetail?: string | null): string {
  if (statusDetail && CARD_STATUS_DETAIL_MESSAGES[statusDetail]) {
    return CARD_STATUS_DETAIL_MESSAGES[statusDetail];
  }
  return "Pagamento recusado. Verifique os dados do cartão ou tente outro meio de pagamento.";
}

function sanitizeEmail(email: string): string {
  const markdownMatch = email.match(/\(mailto:([^)]+)\)/);
  if (markdownMatch) return markdownMatch[1].trim();
  if (email.startsWith("mailto:")) return email.replace("mailto:", "").trim();
  return email.trim();
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CardForm({
  step,
  amount,
  publicKey,
  email,
  customerName = "",
  telefone = "",
  cpf = "",
  selectedAlbums = [],
  checkoutDraftId,
}: CardFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [isLoadingPix, setIsLoadingPix] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [isSdkInitialized, setIsSdkInitialized] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [pixExpired, setPixExpired] = useState(false);
  const [pixPaid, setPixPaid] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanAmount = amount.replace('R$ ', '').replace(',', '.').trim();
  const numericAmount = parseFloat(cleanAmount);

  // O brick de cartão remonta (via key) quando o total muda, pra recalcular
  // parcelas. Mas se o total mudar várias vezes rápido (usuário alternando
  // order bumps), cada mudança derruba os iframes de Secure Fields no meio da
  // configuração — daí o erro "fields_setup_failed_after_3_tries". Só remonta
  // depois que o total parar de mudar por um instante.
  const [stableAmount, setStableAmount] = useState(numericAmount);
  useEffect(() => {
    const timeout = setTimeout(() => setStableAmount(numericAmount), 600);
    return () => clearTimeout(timeout);
  }, [numericAmount]);

  useEffect(() => {
    if (step !== 3) return;
    if (!isSdkInitialized && publicKey) {
      initMercadoPago(publicKey, { locale: 'pt-BR' });
      setIsSdkInitialized(true);
    }
  }, [step, publicKey, isSdkInitialized]);

  useEffect(() => {
    const savedPix = localStorage.getItem(PIX_STORAGE_KEY);
    const savedExpiry = localStorage.getItem(PIX_EXPIRY_KEY);

    if (savedPix && savedExpiry) {
      const expiryTimestamp = parseInt(savedExpiry);
      const now = Date.now();
      const secondsLeft = Math.floor((expiryTimestamp - now) / 1000);
      const parsedPix: PixData = JSON.parse(savedPix);
      // PIX_STORAGE_KEY é global (não amarrado ao pedido) — se o valor salvo
      // não bate com o pedido atual, é sobra de um checkout anterior (outra
      // campanha/preço) ainda dentro da janela de 5min. Restaurar sem checar
      // mostraria o QR Code de um valor errado (ex.: 39 num pedido de 19).
      const amountMatches = Math.abs(parsedPix.amount - numericAmount) < 0.01;

      if (secondsLeft > 0 && amountMatches) {
        setPixData(parsedPix);
        setTimeLeft(secondsLeft);
        setPaymentMethod('pix');
        startTimer(secondsLeft);
      } else {
        clearPixStorage();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);


  useEffect(() => {
    if (!pixData || pixExpired) return;

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/payments/status/${pixData.payment_id}`);
        const json = await res.json();
        if (json.status === 'approved') {
          clearInterval(pollRef.current!);
          setPixPaid(true);
          clearPixStorage();
          setTimeout(() => {
            window.location.href = `/confirmacao?ref=${pixData.external_reference}&method=pix`;
          }, 2000);
        }
      } catch {
        // ignora erros de rede no polling
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pixData, pixExpired]);

  function clearPixStorage() {
    localStorage.removeItem(PIX_STORAGE_KEY);
    localStorage.removeItem(PIX_EXPIRY_KEY);
  }

  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);

    setTimeLeft(seconds);
    setPixExpired(false);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setPixExpired(true);
          setPixData(null);
          clearPixStorage();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const handleGeneratePix = async () => {
    setIsLoadingPix(true);
    setPixError(null);
    setPixExpired(false);

    try {
      const cleanEmail = sanitizeEmail(email);

      const tracking = getTrackingPayload();
      const res = await fetch(`${API_URL}/api/payments/pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: customerName,
          cpf: cpf.replace(/\D/g, ""),
          selectedAlbums,
          amount: numericAmount,
          telefone: telefone || null,
          fbp: tracking.fbp,
          fbc: tracking.fbc,
          user_agent: tracking.user_agent,
          event_source_url: tracking.event_source_url,
          referrer: tracking.referrer,
          checkoutDraftId,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Erro ao gerar PIX");
      }

      const pix: PixData = {
        payment_id: json.data.order_id,
        external_reference: json.data.external_reference,
        qr_code: json.data.pix.qr_code,
        qr_code_base64: json.data.pix.qr_code_base64,
        ticket_url: json.data.pix.ticket_url,
        expires_at: json.data.pix.expires_at,
        amount: json.data.amount,
      };

      const secondsLeft = 5 * 60;
      const expiryTimestamp = Date.now() + secondsLeft * 1000;

      localStorage.setItem(PIX_STORAGE_KEY, JSON.stringify(pix));
      localStorage.setItem(PIX_EXPIRY_KEY, String(expiryTimestamp));

      setPixData(pix);
      startTimer(secondsLeft);
    } catch (err: any) {
      setPixError(err.message || "Erro ao gerar PIX");
    } finally {
      setIsLoadingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  const handleNewPix = () => {
    clearPixStorage();
    setPixData(null);
    setPixExpired(false);
    setTimeLeft(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Trocar pra aba de cartão com um PIX pendente precisa abandonar esse PIX
  // (parar polling/timer e limpar localStorage) — senão o polling continua
  // batendo em segundo plano e, se aquele PIX antigo for aprovado, redireciona
  // a página sozinho pra /confirmacao no meio do preenchimento do cartão.
  const handleSelectCard = () => {
    if (pixData && !pixPaid) {
      handleNewPix();
    }
    setPaymentMethod('card');
  };

  const handleCardSubmit = async (param: any) => {
    setIsProcessingCard(true);
    setCardError(null);
    try {
      const tracking = getTrackingPayload();
      const res = await fetch(`${API_URL}/api/payments/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...param,
          customerName,
          telefone,
          selectedAlbums,
          fbp: tracking.fbp,
          fbc: tracking.fbc,
          user_agent: tracking.user_agent,
          event_source_url: tracking.event_source_url,
          referrer: tracking.referrer,
          checkoutDraftId,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Erro ao processar pagamento');
      }

      const mpStatus = json.data?.status;
      const externalReference = json.data?.external_reference ?? '';
      const orderParam = externalReference ? `&order_id=${externalReference}` : '';

      if (mpStatus === 'approved') {
        window.location.href = `/confirmacao?method=card&status=approved${orderParam}`;
      } else if (mpStatus === 'in_process' || mpStatus === 'pending') {
        window.location.href = `/confirmacao?method=card&status=pending${orderParam}`;
      } else {
        throw new Error(friendlyCardErrorMessage(json.data?.status_detail));
      }
    } catch (err: any) {
      setCardError(err.message || 'Erro ao processar pagamento');
    } finally {
      setIsProcessingCard(false);
    }
  };

  if (step !== 3) return null;

  return (
    <div className="space-y-4">
      {/* Seletor de método */}
      <div className="bg-gray-50 rounded-2xl p-2 flex gap-2">
        <button
          onClick={handleSelectCard}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            paymentMethod === 'card'
              ? 'bg-white shadow-md text-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard className="h-5 w-5" />
          Cartão
        </button>
        <button
          onClick={() => setPaymentMethod('pix')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            paymentMethod === 'pix'
              ? 'bg-white shadow-md text-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <QrCode className="h-5 w-5" />
          PIX
        </button>
      </div>

      {/* Erro cartão */}
      {paymentMethod === 'card' && cardError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 text-sm">❌ {cardError}</p>
        </div>
      )}

      {/* Cartão — loading */}
      {paymentMethod === 'card' && !isSdkInitialized && (
        <div className="flex items-center justify-center py-8 gap-3 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          <span className="text-sm">Carregando formulário de pagamento...</span>
        </div>
      )}

      {/* Cartão — brick */}
      {paymentMethod === 'card' && isSdkInitialized && (
        <div className="mp-brick-wrapper">
        <CardPayment
          key={stableAmount}
          initialization={{
            amount: stableAmount,
            payer: {
              email: sanitizeEmail(email),
              firstName: customerName.split(' ')[0] || "",
              lastName: customerName.split(' ').slice(1).join(' ') || "",
              ...(cpf ? { identification: { type: 'CPF', number: cpf.replace(/\D/g, '') } } : {}),
            } as any,
          }}
          onSubmit={handleCardSubmit}
          onError={(error) => console.error('Erro cartão:', error)}
          customization={{
            paymentMethods: { creditCard: 'all', debitCard: 'all' } as any,
            visual: {
              style: { theme: 'default', borderRadius: '12px', fontSize: '16px' },
            },
          }}
        />
        </div>
      )}

      {/* PIX */}
      {paymentMethod === 'pix' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-800 text-lg">📱 Pagamento com PIX</h3>
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-xs text-green-600">
              Pague instantaneamente. Confirmação em segundos.
            </p>
          </div>

          {/* PIX expirado */}
          {pixExpired && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 font-semibold mb-2">⏰ PIX expirado!</p>
              <p className="text-red-600 text-sm mb-3">Gere um novo código para continuar.</p>
              <button
                onClick={handleNewPix}
                className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-xl transition-colors"
              >
                Gerar novo PIX
              </button>
            </div>
          )}

          {/* Erro */}
          {pixError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-700 text-sm">❌ {pixError}</p>
            </div>
          )}

          {/* Botão gerar PIX */}
          {!pixData && !pixExpired && (
            <button
              onClick={handleGeneratePix}
              disabled={isLoadingPix}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoadingPix ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Gerando PIX...
                </>
              ) : (
                <>
                  <QrCode className="h-5 w-5" />
                  Gerar QR Code PIX
                </>
              )}
            </button>
          )}

          {/* PIX pago */}
          {pixPaid && (
            <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-6 text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="font-bold text-green-700 text-lg">Pagamento confirmado!</p>
              <p className="text-green-600 text-sm mt-1">Redirecionando...</p>
            </div>
          )}

          {/* QR Code gerado */}
          {pixData && !pixExpired && !pixPaid && (
            <div className="space-y-3">
              {/* Timer */}
              <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl ${
                timeLeft < 60
                  ? "bg-red-50 border border-red-200"
                  : "bg-blue-50 border border-blue-200"
              }`}>
                <span className="text-lg">⏱️</span>
                <span className={`font-bold text-lg ${
                  timeLeft < 60 ? "text-red-600" : "text-blue-600"
                }`}>
                  {formatTimer(timeLeft)}
                </span>
                <span className={`text-sm ${
                  timeLeft < 60 ? "text-red-500" : "text-blue-500"
                }`}>
                  para expirar
                </span>
              </div>

              {/* QR Code */}
              <div className="bg-white rounded-2xl p-6 text-center border-2 border-gray-100">
                <img
                  src={`data:image/png;base64,${pixData.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 mx-auto mb-4"
                />

                <button
                  onClick={handleCopyPix}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-xl transition-colors mb-2"
                >
                  {pixCopied ? '✅ Código copiado!' : '📋 Copiar código PIX'}
                </button>
                <p className="text-xs text-gray-500 mt-3">
                  Escaneie o QR Code ou cole o código no app do seu banco
                </p>
              </div>

              {/* Valor */}
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  Valor:{" "}
                  <strong className="text-primary text-lg">
                    R$ {pixData.amount.toFixed(2).replace(".", ",")}
                  </strong>
                </p>
              </div>

              <button
                onClick={handleNewPix}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
              >
                Cancelar e gerar novo PIX
              </button>
            </div>
          )}

          {/* Info expiração */}
          {!pixData && !pixExpired && (
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
              <p className="text-xs text-yellow-800 text-center">
                ⏱️ O QR Code PIX expira em 5 minutos após gerado
              </p>
            </div>
          )}
        </div>
      )}

      {/* Badges segurança */}
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3 text-green-600" />
          <span className="text-xs text-gray-500">Dados criptografados</span>
        </div>
        <div className="w-px h-3 bg-gray-300" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">⚡ Pagamento rápido</span>
        </div>
        <div className="w-px h-3 bg-gray-300" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">👁️ Monitoramento 24h</span>
        </div>
      </div>
    </div>
  );
}