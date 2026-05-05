import { useEffect, useState, useRef } from 'react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { CreditCard, QrCode, Lock } from './Icons.tsx';

type CardFormProps = {
  step: number;
  amount: string;
  publicKey: string;
  email: string;
  customerName?: string;
  cpf?: string;
  selectedAlbums?: { albumId: string; childName: string }[];
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
  cpf = "",
  selectedAlbums = [],
}: CardFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [isLoadingPix, setIsLoadingPix] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [isSdkInitialized, setIsSdkInitialized] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [pixExpired, setPixExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanAmount = amount.replace('R$ ', '').replace(',', '.').trim();
  const numericAmount = parseFloat(cleanAmount);

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

      if (secondsLeft > 0) {
        setPixData(JSON.parse(savedPix));
        setTimeLeft(secondsLeft);
        setPaymentMethod('pix');
        startTimer(secondsLeft);
      } else {
        clearPixStorage();
        setPixExpired(true);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

      const res = await fetch(`${API_URL}/api/payments/pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: customerName,
          cpf: cpf.replace(/\D/g, ""),
          selectedAlbums,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Erro ao gerar PIX");
      }

      const pix: PixData = {
        payment_id: json.data.payment_id,
        external_reference: json.data.external_reference,
        qr_code: json.data.pix.qr_code,
        qr_code_base64: json.data.pix.qr_code_base64,
        ticket_url: json.data.pix.ticket_url,
        expires_at: json.data.pix.expires_at,
        amount: json.data.amount,
      };

      const expiryDate = new Date(pix.expires_at);
      const now = Date.now();
      const secondsLeft = Math.floor((expiryDate.getTime() - now) / 1000);
      const expiryTimestamp = now + secondsLeft * 1000;

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
  };

  const handleCardSubmit = async (param: any) => {
    console.log('Pagamento cartão:', param);
  };

  if (step !== 3) return null;

  return (
    <div className="space-y-4">
      {/* Dados do Cliente */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <h4 className="font-semibold text-gray-700 mb-2">📋 Dados do Cliente</h4>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-gray-500">Nome:</span>{" "}
            <strong>{customerName || "Não informado"}</strong>
          </p>
          <p>
            <span className="text-gray-500">E-mail:</span>{" "}
            <strong>{sanitizeEmail(email) || "Não informado"}</strong>
          </p>
        </div>
      </div>

      {/* Seletor de método */}
      <div className="bg-gray-50 rounded-2xl p-2 flex gap-2">
        <button
          onClick={() => setPaymentMethod('card')}
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

      {/* Cartão */}
      {paymentMethod === 'card' && (
        <CardPayment
          initialization={{
            amount: numericAmount,
            payer: {
              email: sanitizeEmail(email),
              firstName: customerName.split(' ')[0] || "",
              lastName: customerName.split(' ').slice(1).join(' ') || "",
            },
          }}
          onSubmit={handleCardSubmit}
          onError={(error) => console.error('Erro cartão:', error)}
          customization={{
            paymentMethods: { creditCard: 'all', debitCard: 'all' },
            visual: {
              style: { theme: 'default', borderRadius: '12px', fontSize: '16px' },
            },
          }}
        />
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

          {/* QR Code gerado */}
          {pixData && !pixExpired && (
            <div className="space-y-3">
              {/* Timer */}
              <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl ${
                timeLeft < 300
                  ? "bg-red-50 border border-red-200"
                  : "bg-blue-50 border border-blue-200"
              }`}>
                <span className="text-lg">⏱️</span>
                <span className={`font-bold text-lg ${
                  timeLeft < 300 ? "text-red-600" : "text-blue-600"
                }`}>
                  {formatTimer(timeLeft)}
                </span>
                <span className={`text-sm ${
                  timeLeft < 300 ? "text-red-500" : "text-blue-500"
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

                  {pixData.ticket_url && (
                    <a
                      href={pixData.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-blue-500 hover:underline mt-1"
                    >
                      Abrir página do pagamento
                    </a>
                  )}
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
                ⏱️ O QR Code PIX expira em 30 minutos após gerado
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