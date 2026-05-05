import { useEffect, useState } from 'react';
import album1Img from '../assets/album-1.jpg';
import album2Img from '../assets/album-2.jpg';
import { Check } from './Icons';

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

export default function CampaignCombo({ campaignId }: { campaignId: string }) {
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
        <h2 className="text-center font-black text-4xl text-[#333] md:text-6xl mb-12 uppercase tracking-tighter">
          Promoção combo especial
        </h2>
        <div className="relative mx-auto max-w-4xl rounded-[3rem] bg-white p-8 pt-16 shadow-2xl md:p-16">
          <div className="absolute -top-5 left-8 md:left-12">
            <span className="rounded-xl border-2 border-dashed border-slate-900 bg-[#FFD700] px-6 py-2 text-sm font-black uppercase tracking-tight text-slate-900">
              Mais vendido
            </span>
          </div>
          <div className="text-center">
            <h3 className="flex flex-wrap justify-center items-center gap-2 text-2xl font-black text-slate-700 md:text-4xl">
              Álbum 1 <span className="text-[#FFD700] text-4xl drop-shadow-sm">+</span>
              Álbum 2 <span className="text-[#FFD700] text-4xl drop-shadow-sm">+</span>
              Parabéns personalizado <span className="text-[#FFD700] text-4xl drop-shadow-sm">+</span>
              Ebook
            </h3>
            <div className="my-10 flex justify-center gap-2">
              <img src={album1Img.src} alt="Cantigas 1" className="w-40 md:w-60 shadow-xl" />
              <img src={album2Img.src} alt="Cantigas 2" className="w-40 md:w-60 shadow-xl" />
            </div>
            <ul className="inline-block space-y-3 text-left text-lg font-bold text-slate-600">
              {ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-1 h-6 w-6 flex-shrink-0 text-green-500 stroke-[3px]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col items-center gap-4">
              {combo ? (
                <>
                  <div className="flex items-center gap-4 font-bold">
                    {combo.priceOld > 0 && (
                      <span className="text-xl text-slate-400 line-through">
                        de R$ {formatPrice(combo.priceOld)}
                      </span>
                    )}
                    <span className="text-5xl font-black text-red-600 italic">
                      <small className="text-2xl not-italic">por R$</small>{' '}
                      {formatPrice(combo.priceNew)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleBuy}
                    className="group flex items-center justify-center gap-3 rounded-full bg-red-600 px-12 py-5 text-2xl font-black uppercase text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
                  >
                    Comprar agora 🛒
                  </button>
                </>
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
