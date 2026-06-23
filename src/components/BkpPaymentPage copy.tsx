// src/components/PaymentPage.tsx
import { useState, useEffect } from 'react';
import CardForm from './CardForm.tsx';
import { ArrowLeft, Lock, CheckCircle, Music, Heart } from './Icons.tsx';

interface OrderData {
    customerData: {
        fullName: string;
        email: string;
        telefone: string;
    };
    children: Array<{ id: string; name: string }>;
    useCustomName: boolean;
    productName: string;
    productPrice: string;
    total: string;
}

export default function PaymentPage() {
    const [orderData, setOrderData] = useState<OrderData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Recuperar dados do localStorage
        const savedData = localStorage.getItem('orderData');
        if (savedData) {
            setOrderData(JSON.parse(savedData));
        }
        setIsLoading(false);
    }, []);

    const handleBack = () => {
        window.location.href = '/';
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
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
        <div className="max-w-6xl mx-auto px-4">
            {/* Botão voltar */}
            <button 
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors group"
            >
                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                Voltar
            </button>

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Coluna da esquerda - Resumo do pedido */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden sticky top-6">
                        {/* Header do resumo */}
                        <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                🎵 Resumo do Pedido
                            </h2>
                            <p className="text-white/90 mt-1">Revise os dados antes de finalizar</p>
                        </div>

                        {/* Conteúdo do resumo */}
                        <div className="p-6 space-y-6">
                            {/* Produto */}
                            <div className="border-b border-gray-100 pb-4">
                                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <Music className="h-4 w-4" />
                                    Produto
                                </h3>
                                <p className="text-gray-900 font-medium">{orderData.productName}</p>
                            </div>

                            {/* Cliente */}
                            <div className="border-b border-gray-100 pb-4">
                                <h3 className="font-semibold text-gray-700 mb-2">👤 Dados do Cliente</h3>
                                <div className="space-y-1 text-sm">
                                    <p><span className="text-gray-500">Nome:</span> <span className="font-medium">{orderData.customerData.fullName}</span></p>
                                    <p><span className="text-gray-500">E-mail:</span> <span className="font-medium">{orderData.customerData.email}</span></p>
                                    <p><span className="text-gray-500">Telefone:</span> <span className="font-medium">{orderData.customerData.telefone}</span></p>
                                </div>
                            </div>

                            {/* Crianças */}
                            <div className="border-b border-gray-100 pb-4">
                                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <Heart className="h-4 w-4" />
                                    Crianças
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {orderData.children.map((child) => (
                                        <span key={child.id} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                                            {child.name}
                                        </span>
                                    ))}
                                </div>
                                {orderData.useCustomName && (
                                    <p className="text-xs text-primary mt-2">✨ Inclui nome personalizado (+ R$ 30,00)</p>
                                )}
                            </div>

                            {/* Total */}
                            <div className="bg-gray-50 rounded-2xl p-4">
                                <div className="flex justify-between items-center text-lg">
                                    <span className="font-bold text-gray-700">Total a pagar:</span>
                                    <span className="text-3xl font-bold text-primary">
                                        R$ {orderData.total.replace('.', ',')}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Em até 12x no cartão
                                </p>
                            </div>

                            {/* Selo de segurança */}
                            <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-xl p-3">
                                <Lock className="h-4 w-4" />
                                <span className="text-sm font-medium">Compra 100% segura</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna da direita - Formulário de pagamento */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                💳 Pagamento
                            </h2>
                            <p className="text-white/90 mt-1">Escolha a forma de pagamento</p>
                        </div>

                        <div className="p-6">
                            <CardForm
                                step={3}
                                amount={`R$ ${orderData.total.replace('.', ',')}`}
                                publicKey={import.meta.env.PUBLIC_MP_PUBLIC_KEY || ''}
                                email={orderData.customerData.email}
                                customerName={orderData.customerData.fullName}
                            />
                        </div>
                    </div>

                    {/* Garantia */}
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