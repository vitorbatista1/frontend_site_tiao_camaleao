// src/hooks/useModal.ts
import { useState, useCallback } from "react";

interface ProductInfo {
    name: string;
    price: string;
    isCombo?: boolean;
}

export function useModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [productInfo, setProductInfo] = useState<ProductInfo>({
        name: "Cantigas Personalizadas",
        price: "R$ 47,00",
        isCombo: false
    });

    const openModal = useCallback((info?: ProductInfo) => {
        if (info) {
            setProductInfo(info);
        }
        setIsOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsOpen(false);
    }, []);

    return {
        isOpen,
        openModal,
        closeModal,
        productInfo
    };
}