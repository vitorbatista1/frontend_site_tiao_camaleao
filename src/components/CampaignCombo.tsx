import { useEffect, useState } from 'react';

const API_URL = import.meta.env.PUBLIC_API_URL;

interface Combo {
  id: string;
  name: string;
  priceOld: number;
  priceNew: number;
  campanha: string;
}

function formatPrice(value: number) {
  return value.toFixed(2).replace('.', ',');
}

const ITEMS = [
  'Um super desconto no segundo álbum',
  'Total de 15 cantigas personalizadas',
  'Parabéns pra Você autoral com o nome da criança',
  'Ebook ilustrado com letras e cifras das cantigas',
];

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-1 h-6 w-6 flex-shrink-0 text-green-500"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface Props {
  campaignId: string;
  album1Src: string;
  album2Src: string;
}

export default function CampaignCombo({ campaignId, album1Src, album2Src }: Props) {
  const [combo, setCombo] = useState<Combo | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/albums/combos?campanha=${campaignId}&tipo=COMBO`)
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data.data) ? data.data[0] : data.data;
        if (!raw) return;
        setCombo({
          ...raw,
          priceOld: Number(raw.priceOld),
          priceNew: Number(raw.priceNew),
        });
      })
      .catch(() => {});
  }, [campaignId]);

  function handleBuy() {
    if (!combo) return;
    window.dispatchEvent(
      new CustomEvent('open-modal', {
        detail: {
          name: combo.name,
          price: `R$ ${formatPrice(combo.priceNew)}`,
          combo: true,
        },
      })
    );
  }

  return (
    <section className="py-20 bg-[#FFD700]">
      <div className="container">
        <h2 className="text-center text-4xl text-[#4a3a00] md:text-5xl mb-12 tracking-tighter">
          Promoção combo especial
        </h2>

        <div className="relative mx-auto max-w-4xl rounded-[3rem] bg-white p-8 pt-16 shadow-2xl md:p-16">
          {/* Badge */}
          <div className="absolute -top-5 left-8 md:left-12">
            <span className="rounded-xl border-2 border-dashed border-slate-900 bg-[#FFD700] px-6 py-2 text-sm font-black uppercase tracking-tight text-slate-900">
              Mais vendido
            </span>
          </div>

          <div className="text-center">
            {/* Subtitle */}
            <h3 className="text-xl font-black text-slate-700 md:text-3xl">
              <div className="flex flex-wrap justify-center items-center gap-2">
                Álbum 1{' '}
                <span className="text-[#FFD700] text-3xl drop-shadow-sm">+</span>{' '}
                Álbum 2
              </div>
              <div className="flex flex-wrap justify-center items-center gap-2 mt-1">
                <span className="text-[#FFD700] text-3xl drop-shadow-sm">+</span>{' '}
                Parabéns personalizado{' '}
                <span className="text-[#FFD700] text-3xl drop-shadow-sm">+</span>{' '}
                Ebook
              </div>
            </h3>

            {/* Album images + Price lado a lado */}
            <div className="my-10 flex justify-center items-end gap-4">
              <div className="flex">
                <img
                  src={album1Src}
                  alt="Cantigas Personalizadas 1"
                  width={450}
                  height={450}
                  className="w-36 md:w-44"
                />
                <img
                  src={album2Src}
                  alt="Cantigas Personalizadas 2"
                  width={450}
                  height={450}
                  className="w-36 md:w-44 -ml-10"
                />
              </div>

              {/* Price — à direita das imagens */}
              {combo && (
                <div className="flex flex-col items-start gap-0.5 font-bold mb-1 -ml-6">
                  {combo.priceOld > 0 && (
                    <span className="text-sm text-slate-400 line-through">
                      de R$ {formatPrice(combo.priceOld)}
                    </span>
                  )}
                  <span className="text-3xl font-black text-red-600 italic leading-tight">
                    <small className="text-base not-italic">por R$</small>{' '}
                    {formatPrice(combo.priceNew)}
                  </span>
                </div>
              )}
            </div>

            {/* Items list */}
            <ul className="inline-block space-y-3 text-left text-lg font-bold text-slate-600 mb-10">
              {ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="flex flex-col items-center gap-4">
              {combo ? (
                <button
                  type="button"
                  onClick={handleBuy}
                  className="group flex items-center justify-center gap-3 rounded-full bg-red-600 px-12 py-5 text-2xl font-black uppercase text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
                >
                  Comprar agora 🛒
                </button>
              ) : (
                <div className="h-20 flex items-center justify-center">
                  <span className="text-slate-400 text-sm">Carregando...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}