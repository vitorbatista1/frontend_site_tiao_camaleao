// src/components/OrderBump.tsx
import { useState } from 'react';
import { CheckCircle, Zap, Gift, TrendingUp } from './Icons.tsx';

interface OrderBumpProps {
    title: string;
    description: string;
    originalPrice: number;
    offerPrice: number;
    icon?: 'zap' | 'gift' | 'trending';
    onSelect: (selected: boolean) => void;
}

export default function OrderBump({ 
    title, 
    description, 
    originalPrice, 
    offerPrice, 
    icon = 'zap',
    onSelect 
}: OrderBumpProps) {
    const [isSelected, setIsSelected] = useState(false);
    const savings = originalPrice - offerPrice;
    const savingsPercent = Math.round((savings / originalPrice) * 100);

    const getIcon = () => {
        switch(icon) {
            case 'zap': return <Zap className="h-8 w-8 text-yellow-500" />;
            case 'gift': return <Gift className="h-8 w-8 text-pink-500" />;
            case 'trending': return <TrendingUp className="h-8 w-8 text-green-500" />;
            default: return <Zap className="h-8 w-8 text-yellow-500" />;
        }
    };

    const handleSelect = () => {
        const newState = !isSelected;
        setIsSelected(newState);
        onSelect(newState);
    };

    return (
        <div 
            className={`
                relative rounded-2xl p-5 cursor-pointer transition-all duration-300
                ${isSelected 
                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 shadow-lg scale-[1.02]' 
                    : 'bg-gray-50 border-2 border-gray-200 hover:border-yellow-300 hover:shadow-md'
                }
            `}
            onClick={handleSelect}
        >
            {/* Badge de desconto chamativa */}
            <div className="absolute -top-3 -right-3">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse shadow-lg">
                    🔥 -{savingsPercent}% OFF
                </div>
            </div>

            <div className="flex items-start gap-4">
                {/* Ícone chamativo */}
                <div className={`
                    flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center
                    ${isSelected ? 'bg-yellow-100' : 'bg-white'}
                `}>
                    {getIcon()}
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
                        {isSelected && (
                            <CheckCircle className="h-5 w-5 text-green-500 animate-bounce" />
                        )}
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3">{description}</p>
                    
                    <div className="flex items-baseline gap-2">
                        <span className="text-gray-400 line-through text-sm">
                            R$ {originalPrice.toFixed(2)}
                        </span>
                        <span className="text-2xl font-bold text-green-600">
                            R$ {offerPrice.toFixed(2)}
                        </span>
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            Economize R$ {savings.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Checkbox estilizado */}
                <div className="flex-shrink-0">
                    <div className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                        ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-400 bg-white'}
                    `}>
                        {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                    </div>
                </div>
            </div>

            {/* Efeito de ondas de oferta limitada */}
            <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
        </div>
    );
}