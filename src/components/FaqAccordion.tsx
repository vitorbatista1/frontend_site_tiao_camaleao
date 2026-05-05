import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "É fácil baixar as músicas após a compra?",
    a: "Sim! Após a confirmação, você recebe um link por e-mail com todas as faixas em alta qualidade, prontas para baixar no celular ou computador.",
  },
  {
    q: "Como saber se o nome do meu filho está disponível para personalização?",
    a: "Temos mais de 2.000 nomes gravados. Se o nome não estiver no acervo, fazemos a gravação personalizada sob encomenda em até 7 dias.",
  },
  {
    q: "Posso ouvir as músicas no celular, no carro e em outros dispositivos?",
    a: "Sim! Os arquivos são em MP3 e funcionam em qualquer aparelho: celular, caixinha de som, carro, computador e tablets.",
  },
  {
    q: "Posso enviar as músicas por WhatsApp e e-mail?",
    a: "Pode sim — as faixas são suas e você pode compartilhar com a família e padrinhos sem nenhuma restrição.",
  },
  {
    q: "Como posso ter certeza de que vou gostar das cantigas?",
    a: "Fica tranquilo, você só compra se realmente gostar. Antes de qualquer compra, nós enviamos uma cantiga de amostra totalmente gratuita com o nome da sua criança. Essa amostra é justamente para você conhecer de perto o nosso trabalho: ouvir como o nome é cantado na música, conhecer o estilo do arranjo e avaliar a qualidade do áudio. Assim, você só decide comprar se realmente gostar do resultado. Nosso objetivo é que você se sinta seguro e confiante — por isso, a amostra existe para garantir que você saiba exatamente o que vai receber antes de fazer o pedido.",
  },
];

export default function FaqAccordion() {
  const [openFaq, setOpenFaq] = useState<number | null>(4);

  return (
    <div className="mt-10 space-y-3">
      {faqs.map((item, i) => {
        const open = openFaq === i;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-2xl border-2 border-border bg-card"
          >
            <button
              type="button"
              onClick={() => setOpenFaq(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold text-foreground transition-colors hover:bg-muted"
              aria-expanded={open}
            >
              <span className="uppercase tracking-wide">{item.q}</span>
              <ChevronDown
                className={`h-5 w-5 flex-shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""
                  }`}
              />
            </button>
            {open && (
              <div className="border-t-2 border-border bg-muted/40 p-5 text-muted-foreground">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
