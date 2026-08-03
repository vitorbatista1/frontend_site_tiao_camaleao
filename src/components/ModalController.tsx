import { useState, useEffect } from "react";
import Modal from "./Modal.tsx";

export default function ModalController() {
  const [isOpen, setIsOpen] = useState(false);
  const [productName, setProductName] = useState("Cantigas Personalizadas");
  const [productPrice, setProductPrice] = useState("R$ 47,00");
  const [isCombo, setIsCombo] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; price?: string; combo?: boolean }>).detail ?? {};
      setProductName(detail.name ?? "Cantigas Personalizadas");
      setProductPrice(detail.price ?? "R$ 47,00");
      setIsCombo(!!detail.combo);
      setIsOpen(true);
    };
    window.addEventListener("open-modal", handler);
    return () => window.removeEventListener("open-modal", handler);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      productName={productName}
      productPrice={productPrice}
      isCombo={isCombo}
    />
  );
}
