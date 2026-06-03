import { useState, useEffect, useRef } from "react";
import { X, Check, ChevronRight, Plus, Trash2 } from "./Icons.tsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
  productPrice?: string;
  isCombo?: boolean;
}

interface CustomerData {
  fullName: string;
  email: string;
  telefone: string;
}

interface AlbumResult {
  found: boolean;
  display_name?: string;
  albums?: string[];
  message?: string;
}

interface Child {
  id: string;
  name: string;
  albumResult?: AlbumResult | null;
  isSearching?: boolean;
  selectedAlbums?: string[];
}

interface AlbumAPI {
  id: string;
  name: string;
  linkAmostra: string;
  linkImgAlbum: string;
  priceOld: string;
  priceNew: string;
  createdAt: string;
  campanha: string;
  tipo: "ALBUM" | "COMBO" | "GRAVACAO";
}

const API_URL = import.meta.env.PUBLIC_API_URL;
const COMBO_GRAVADO_PRICE_FULL = 150;
const COMBO_GRAVADO_ONE_MISSING = 120;

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function Modal({
  isOpen,
  onClose,
  productName = "Cantigas Personalizadas",
  productPrice = "R$ 47,00",
  isCombo = false,
}: ModalProps) {
  const [step, setStep] = useState(1);
  const [customerData, setCustomerData] = useState<CustomerData>({
    fullName: "",
    email: "",
    telefone: "",
  });
  const [children, setChildren] = useState<Child[]>([
    {
      id: Date.now().toString(),
      name: "",
      albumResult: null,
      isSearching: false,
      selectedAlbums: [],
    },
  ]);
  const [albumErrors, setAlbumErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState({
    fullName: "",
    email: "",
    telefone: "",
  });

  // Álbuns da API
  const [albumsAPI, setAlbumsAPI] = useState<AlbumAPI[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);

  // Busca os álbuns da API ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;

    const fetchAlbums = async () => {
      setLoadingAlbums(true);
      try {
        const res = await fetch(`${API_URL}/api/albums`);
        const json = await res.json();
        if (json.success) {
          setAlbumsAPI(json.data);
        }
      } catch (err) {
        console.error("Erro ao buscar álbuns:", err);
      } finally {
        setLoadingAlbums(false);
      }
    };

    fetchAlbums();
  }, [isOpen]);

  // Helpers para pegar dados do álbum da API
  // Mapeia album_1, album_2, album_3 para os ALBUNs da API (ordem de criação)
  const getAlbumsOnly = () => albumsAPI.filter((a) => a.tipo === "ALBUM");
  const getCombo = () => albumsAPI.find((a) => a.tipo === "COMBO");
  const getGravacaoAlbums = () => albumsAPI.filter((a) => a.tipo === "GRAVACAO");
  // Retorna só as gravações individuais (1 por álbum), excluindo o produto "Combo - GRAVAÇÃO"
  const getGravacaoIndividuais = () => getGravacaoAlbums().slice(0, getAlbumsOnly().length);

  const getAlbumByKey = (key: string): AlbumAPI | undefined => {
    const albums = getAlbumsOnly();
    const index = parseInt(key.replace("album_", "")) - 1;
    return albums[index];
  };

  const getAlbumById = (id: string): AlbumAPI | undefined =>
    albumsAPI.find((a) => a.id === id);

  const getAlbumLabel = (id: string): string =>
    getAlbumById(id)?.name ?? id;

  const getAlbumPrice = (id: string): number =>
    parseFloat(getAlbumById(id)?.priceNew ?? "0");

  const getAlbumPriceOld = (id: string): number =>
    parseFloat(getAlbumById(id)?.priceOld ?? "0");

  const getGravacaoIds = () => getGravacaoAlbums().map((a) => a.id);

  const isComboGravadoSelected = (selectedAlbums: string[]) => {
    const ids = getGravacaoIds();
    return ids.length >= 2 && ids.every((id) => selectedAlbums.includes(id));
  };

  const calcularSubtotal = (selected: string[], foundAlbumsCount = 0) => {
    if (isComboGravadoSelected(selected)) {
      const gravacaoIds = getGravacaoIds();
      const extras = selected.filter((id) => !gravacaoIds.includes(id));
      const comboPrice = foundAlbumsCount >= 1 ? COMBO_GRAVADO_ONE_MISSING : COMBO_GRAVADO_PRICE_FULL;
      return comboPrice + extras.reduce((acc, id) => acc + getAlbumPrice(id), 0);
    }
    return selected.reduce((acc, id) => acc + getAlbumPrice(id), 0);
  };

  const calcularTotal = () => {
    return children
      .reduce((total, c) => {
        const foundCount = c.albumResult?.found ? (c.albumResult.albums?.length ?? 0) : 0;
        return total + calcularSubtotal(c.selectedAlbums ?? [], foundCount);
      }, 0)
      .toFixed(2);
  };

  const debouncedSearch = useRef(
    debounce(async (childId: string, name: string) => {
      if (!name.trim() || name.trim().length < 2) {
        setChildren((prev) =>
          prev.map((c) =>
            c.id === childId
              ? { ...c, albumResult: null, isSearching: false, selectedAlbums: [] }
              : c
          )
        );
        return;
      }

      try {
        const url = `${API_URL}/api/children/search?name=${encodeURIComponent(name.trim())}`;
        const res = await fetch(url);
        const data: AlbumResult = await res.json();

        setChildren((prev) =>
          prev.map((c) =>
            c.id === childId
              ? { ...c, albumResult: data, isSearching: false, selectedAlbums: [] }
              : c
          )
        );
      } catch (err) {
        console.error("Erro ao buscar álbuns:", err);
        setChildren((prev) =>
          prev.map((c) =>
            c.id === childId
              ? { ...c, albumResult: null, isSearching: false, selectedAlbums: [] }
              : c
          )
        );
      }
    }, 600)
  ).current;

  const updateChild = (id: string, name: string) => {
    setChildren((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name,
              albumResult: null,
              isSearching: name.trim().length >= 2,
              selectedAlbums: [],
            }
          : c
      )
    );
    debouncedSearch(id, name);
  };

  const toggleAlbum = (childId: string, albumKey: string) => {
    const realId =
      albumKey === "combo"
        ? (getCombo()?.id ?? "combo")
        : (getAlbumByKey(albumKey)?.id ?? albumKey);

    setChildren((prev) =>
      prev.map((c) => {
        if (c.id !== childId) return c;
        const current = c.selectedAlbums ?? [];
        const comboId = getCombo()?.id ?? "combo";

        if (albumKey === "combo") {
          return {
            ...c,
            selectedAlbums: current.includes(comboId) ? [] : [comboId],
          };
        }

        const withoutCombo = current.filter((a) => a !== comboId);
        const alreadySelected = withoutCombo.includes(realId);

        return {
          ...c,
          selectedAlbums: alreadySelected
            ? withoutCombo.filter((a) => a !== realId)
            : [...withoutCombo, realId],
        };
      })
    );
    setAlbumErrors((prev) => ({ ...prev, [childId]: "" }));
  };

  const toggleComboGravado = (childId: string) => {
    const gravacaoIds = getGravacaoIds();
    setChildren((prev) =>
      prev.map((c) => {
        if (c.id !== childId) return c;
        const selected = c.selectedAlbums ?? [];
        const ativo = isComboGravadoSelected(selected);
        const semGravacao = selected.filter((id) => !gravacaoIds.includes(id));
        return {
          ...c,
          selectedAlbums: ativo ? semGravacao : [...semGravacao, ...gravacaoIds],
        };
      })
    );
    setAlbumErrors((prev) => ({ ...prev, [childId]: "" }));
  };

  const handlePhoneChange = (value: string) => {
    let numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      numbers = numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else {
      numbers = numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    if (numbers.length > 15) numbers = numbers.slice(0, 15);
    setCustomerData((prev) => ({ ...prev, telefone: numbers }));
  };

  const addChild = () => {
    setChildren((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        albumResult: null,
        isSearching: false,
        selectedAlbums: [],
      },
    ]);
  };

  const removeChild = (id: string) => {
    setChildren((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((c) => c.id !== id);
    });
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setStep(1);
      setCustomerData({ fullName: "", email: "", telefone: "" });
      setChildren([
        {
          id: Date.now().toString(),
          name: "",
          albumResult: null,
          isSearching: false,
          selectedAlbums: [],
        },
      ]);
      setAlbumErrors({});
      setErrors({ fullName: "", email: "", telefone: "" });
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        step > 1 ? setStep(step - 1) : onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, step]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validatePhone = (phone: string) => {
    const n = phone.replace(/\D/g, "");
    return n.length === 10 || n.length === 11;
  };

  const validateStep1 = () => {
    const newErrors = { fullName: "", email: "", telefone: "" };
    let isValid = true;

    if (!customerData.fullName.trim()) {
      newErrors.fullName = "Nome completo é obrigatório";
      isValid = false;
    } else if (customerData.fullName.trim().length < 3) {
      newErrors.fullName = "Nome deve ter pelo menos 3 caracteres";
      isValid = false;
    }
    if (!customerData.email.trim()) {
      newErrors.email = "E-mail é obrigatório";
      isValid = false;
    } else if (!validateEmail(customerData.email)) {
      newErrors.email = "E-mail inválido";
      isValid = false;
    }
    if (!customerData.telefone.trim()) {
      newErrors.telefone = "Telefone é obrigatório";
      isValid = false;
    } else if (!validatePhone(customerData.telefone)) {
      newErrors.telefone = "Telefone inválido. Use (XX) XXXXX-XXXX";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const validateStep2 = () => {
    const hasEmpty = children.some((c) => !c.name.trim());
    if (hasEmpty) {
      alert("Por favor, preencha o nome de todas as crianças");
      return false;
    }

    const newErrors: Record<string, string> = {};
    children.forEach((c) => {
      if (
        c.albumResult?.found &&
        (!c.selectedAlbums || c.selectedAlbums.length === 0)
      ) {
        newErrors[c.id] = "Selecione pelo menos um álbum";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setAlbumErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      localStorage.setItem(
        "orderData",
        JSON.stringify({
          customerData,
          children,
          albumsAPI,
          productName,
          total: calcularTotal(),
          isCombo,
        })
      );
      onClose();
      window.location.href = "/pagamento";
    }
  };

  const hasSelections = children.some((c) => (c.selectedAlbums ?? []).length > 0);
  const combo = getCombo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
      />

      <div className="relative max-w-md w-full bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-3xl z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {step === 1 ? "Pré-checkout" : "Dados das Crianças"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {step === 1
                  ? "Informe seus dados para continuar"
                  : "Adicione o nome das crianças"}
              </p>
            </div>
            <button
              onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex gap-2 mt-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-all ${
                  step >= s ? "bg-primary" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    placeholder="Nome completo *"
                    value={customerData.fullName}
                    onChange={(e) => {
                      setCustomerData((prev) => ({ ...prev, fullName: e.target.value }));
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: "" }));
                    }}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      errors.fullName
                        ? "border-red-500"
                        : "border-gray-200 focus:border-primary"
                    }`}
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <input
                    type="email"
                    placeholder="Seu melhor e-mail *"
                    value={customerData.email}
                    onChange={(e) => {
                      setCustomerData((prev) => ({ ...prev, email: e.target.value }));
                      if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      errors.email
                        ? "border-red-500"
                        : "border-gray-200 focus:border-primary"
                    }`}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="(DDD) 9XXXX-XXXX *"
                    value={customerData.telefone}
                    onChange={(e) => {
                      handlePhoneChange(e.target.value);
                      if (errors.telefone) setErrors((prev) => ({ ...prev, telefone: "" }));
                    }}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      errors.telefone
                        ? "border-red-500"
                        : "border-gray-200 focus:border-primary"
                    }`}
                  />
                  {errors.telefone && (
                    <p className="text-red-500 text-xs mt-1">{errors.telefone}</p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <p className="text-xs text-amber-800">
                  ⚠️ <strong>Campos obrigatórios:</strong> Nome completo, E-mail e Telefone
                </p>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm text-blue-800 font-medium mb-1">
                  📝 Adicione o nome das crianças
                </p>
                <p className="text-xs text-blue-600">
                  Vamos verificar quais álbuns estão disponíveis para cada nome
                </p>
              </div>

              {/* Loading álbuns da API */}
              {loadingAlbums && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500">Carregando preços...</span>
                </div>
              )}

              <div className="space-y-5 max-h-[520px] overflow-y-auto pr-1">
                {children.map((child, index) => (
                  <div key={child.id} className="space-y-2">
                    {/* Input nome */}
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={`Nome da criança ${index + 1} *`}
                        value={child.name}
                        onChange={(e) => updateChild(child.id, e.target.value)}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none transition-colors"
                      />
                      <button
                        onClick={() => removeChild(child.id)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Buscando */}
                    {child.isSearching && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-500">Buscando álbuns...</span>
                      </div>
                    )}

                    {/* Álbuns disponíveis + seleção */}
                    {!child.isSearching && child.albumResult?.found && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-600 px-1">
                          Álbuns disponíveis para{" "}
                          <span className="text-primary">
                            {child.albumResult.display_name}
                          </span>:
                        </p>

                        <div className="space-y-2">
                          {/* Álbuns individuais */}
                          {child.albumResult.albums?.map((albumKey) => {
                            const albumData = getAlbumByKey(albumKey);
                            const comboId = getCombo()?.id ?? "combo";
                            const isSelected = (child.selectedAlbums ?? []).includes(albumData?.id ?? albumKey);
                            const isComboSelected = (child.selectedAlbums ?? []).includes(comboId);
                            const priceNew = getAlbumPrice(albumKey);
                            const priceOld = getAlbumPriceOld(albumKey);

                            return (
                              <button
                                key={albumKey}
                                onClick={() => toggleAlbum(child.id, albumKey)}
                                disabled={isComboSelected}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                  isComboSelected
                                    ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                    : isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                      isSelected && !isComboSelected
                                        ? "border-primary bg-primary"
                                        : "border-gray-300"
                                    }`}
                                  >
                                    {isSelected && !isComboSelected && (
                                      <Check className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                  <span className="text-sm font-medium text-left">
                                    {albumData?.name ?? getAlbumLabel(albumKey)}
                                  </span>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                  {priceOld > priceNew && (
                                    <span className="text-xs text-gray-400 line-through block">
                                      R$ {priceOld.toFixed(2).replace(".", ",")}
                                    </span>
                                  )}
                                  <span className="text-sm font-bold text-gray-700">
                                    R$ {priceNew.toFixed(2).replace(".", ",")}
                                  </span>
                                </div>
                              </button>
                            );
                          })}

                          {/* Combo — só mostra se tiver 2+ álbuns E tiver combo cadastrado */}
                          {(child.albumResult.albums?.length ?? 0) >= 2 && combo && (() => {
                            const comboSelected = (child.selectedAlbums ?? []).includes(combo.id);
                            return (
                            <button
                              onClick={() => toggleAlbum(child.id, "combo")}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                comboSelected
                                  ? "border-green-500 bg-green-50"
                                  : "border-dashed border-green-400 hover:bg-green-50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                    comboSelected
                                      ? "border-green-500 bg-green-500"
                                      : "border-green-400"
                                  }`}
                                >
                                  {comboSelected && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <div className="text-left">
                                  <span className="text-sm font-bold text-green-700 block">
                                    🎁 {combo.name}
                                  </span>
                                  <span className="text-xs text-green-600">
                                    Melhor custo-benefício!
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                {parseFloat(combo.priceOld) > parseFloat(combo.priceNew) && (
                                  <span className="text-xs text-green-500 line-through block">
                                    R$ {parseFloat(combo.priceOld).toFixed(2).replace(".", ",")}
                                  </span>
                                )}
                                <span className="text-sm font-bold text-green-700">
                                  R$ {parseFloat(combo.priceNew).toFixed(2).replace(".", ",")}
                                </span>
                              </div>
                            </button>
                            );
                          })()}
                        </div>

                        {/* Oferta de gravação para álbuns faltantes */}
                        {(() => {
                          const albumsOnly = getAlbumsOnly();
                          const childAlbumIds = child.albumResult.albums ?? [];
                          const missing = albumsOnly.filter((a) => !childAlbumIds.includes(a.id));
                          const gravacaoAlbums = getGravacaoAlbums();
                          if (missing.length === 0 || gravacaoAlbums.length === 0) return null;

                          const selected = child.selectedAlbums ?? [];
                          const gravacaoIds = getGravacaoIds();

                          if (missing.length >= 2) {
                            const comboAtivo = isComboGravadoSelected(selected);
                            return (
                              <div className="space-y-1 pt-1">
                                <p className="text-xs font-semibold text-orange-600 px-1">
                                  🎙️ Grave os 2 álbuns com o nome de {child.albumResult.display_name ?? child.name}:
                                </p>
                                <button
                                  onClick={() => toggleComboGravado(child.id)}
                                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                    comboAtivo
                                      ? "border-orange-500 bg-orange-50"
                                      : "border-dashed border-orange-400 hover:bg-orange-50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                      comboAtivo ? "border-orange-500 bg-orange-500" : "border-orange-400"
                                    }`}>
                                      {comboAtivo && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="text-left">
                                      <span className="text-sm font-bold text-orange-700 block">🎁 Combo Gravado</span>
                                      <span className="text-xs text-orange-600">Os 2 álbuns gravados com nome personalizado</span>
                                    </div>
                                  </div>
                                  <span className="text-sm font-bold text-orange-700 ml-2 flex-shrink-0">
                                    R$ {COMBO_GRAVADO_PRICE_FULL.toFixed(2).replace(".", ",")}
                                  </span>
                                </button>
                              </div>
                            );
                          }

                          // 1 álbum faltando — mostra gravação individual (se cadastrada) + opção de combo
                          const missingIndex = albumsOnly.findIndex((a) => a.id === missing[0].id);
                          const gravacaoOffer = gravacaoAlbums[missingIndex];
                          const comboAtivo = isComboGravadoSelected(selected);

                          return (
                            <div className="space-y-1 pt-1">
                              <p className="text-xs font-semibold text-orange-600 px-1">
                                🎙️ Disponível em versão gravada:
                              </p>
                              {gravacaoOffer && (() => {
                                const gravacaoSelected = selected.includes(gravacaoOffer.id);
                                const priceNew = parseFloat(gravacaoOffer.priceNew);
                                const priceOld = parseFloat(gravacaoOffer.priceOld ?? "0");
                                return (
                                  <button
                                    onClick={() => toggleAlbum(child.id, gravacaoOffer.id)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                      gravacaoSelected
                                        ? "border-orange-500 bg-orange-50"
                                        : "border-dashed border-orange-400 hover:bg-orange-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        gravacaoSelected ? "border-orange-500 bg-orange-500" : "border-orange-400"
                                      }`}>
                                        {gravacaoSelected && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <span className="text-sm font-medium text-left">🎙️ {gravacaoOffer.name}</span>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      {priceOld > priceNew && (
                                        <span className="text-xs text-gray-400 line-through block">
                                          R$ {priceOld.toFixed(2).replace(".", ",")}
                                        </span>
                                      )}
                                      <span className="text-sm font-bold text-orange-700">
                                        R$ {priceNew.toFixed(2).replace(".", ",")}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => toggleComboGravado(child.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                  comboAtivo
                                    ? "border-orange-500 bg-orange-50"
                                    : "border-dashed border-orange-400 hover:bg-orange-50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                    comboAtivo ? "border-orange-500 bg-orange-500" : "border-orange-400"
                                  }`}>
                                    {comboAtivo && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="text-left">
                                    <span className="text-sm font-bold text-orange-700 block">🎁 Combo Gravado</span>
                                    <span className="text-xs text-orange-600">Os 2 álbuns gravados — melhor custo-benefício!</span>
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-orange-700 ml-2 flex-shrink-0">
                                  R$ {COMBO_GRAVADO_ONE_MISSING.toFixed(2).replace(".", ",")}
                                </span>
                              </button>
                            </div>
                          );
                        })()}

                        {/* Erro de seleção */}
                        {albumErrors[child.id] && (
                          <p className="text-red-500 text-xs px-1">{albumErrors[child.id]}</p>
                        )}
                      </div>
                    )}

                    {/* Nome não encontrado — oferece gravação (mesmo que faltar todos os álbuns) */}
                    {!child.isSearching &&
                      child.albumResult &&
                      !child.albumResult.found &&
                      child.name.trim().length >= 2 && (() => {
                        const albumsOnly = getAlbumsOnly();
                        const gravacaoAlbums = getGravacaoAlbums();
                        const selected = child.selectedAlbums ?? [];

                        return (
                          <div className="space-y-2">
                            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                              <p className="text-xs text-amber-700">
                                ⚠️ O nome <strong>"{child.name}"</strong> ainda não tem álbum gravado.
                                {gravacaoAlbums.length === 0 && " Entre em contato para mais informações."}
                              </p>
                            </div>

                            {gravacaoAlbums.length > 0 && albumsOnly.length >= 2 && (() => {
                              const gravacaoIndividuais = getGravacaoIndividuais();
                              const comboAtivo = isComboGravadoSelected(selected);
                              return (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-orange-600 px-1">
                                    🎙️ Grave os álbuns com o nome de <strong>{child.name}</strong>:
                                  </p>
                                  {gravacaoIndividuais.map((gravacaoOffer) => {
                                    const gravacaoSelected = selected.includes(gravacaoOffer.id);
                                    const priceNew = parseFloat(gravacaoOffer.priceNew);
                                    const priceOld = parseFloat(gravacaoOffer.priceOld ?? "0");
                                    return (
                                      <button
                                        key={gravacaoOffer.id}
                                        onClick={() => toggleAlbum(child.id, gravacaoOffer.id)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                          gravacaoSelected
                                            ? "border-orange-500 bg-orange-50"
                                            : "border-dashed border-orange-400 hover:bg-orange-50"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                            gravacaoSelected ? "border-orange-500 bg-orange-500" : "border-orange-400"
                                          }`}>
                                            {gravacaoSelected && <Check className="w-3 h-3 text-white" />}
                                          </div>
                                          <span className="text-sm font-medium text-left">🎙️ {gravacaoOffer.name}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                          {priceOld > priceNew && (
                                            <span className="text-xs text-gray-400 line-through block">
                                              R$ {priceOld.toFixed(2).replace(".", ",")}
                                            </span>
                                          )}
                                          <span className="text-sm font-bold text-orange-700">
                                            R$ {priceNew.toFixed(2).replace(".", ",")}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                  <button
                                    onClick={() => toggleComboGravado(child.id)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                      comboAtivo
                                        ? "border-orange-500 bg-orange-50"
                                        : "border-dashed border-orange-400 hover:bg-orange-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        comboAtivo ? "border-orange-500 bg-orange-500" : "border-orange-400"
                                      }`}>
                                        {comboAtivo && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <div className="text-left">
                                        <span className="text-sm font-bold text-orange-700 block">🎁 Combo Gravado</span>
                                        <span className="text-xs text-orange-600">Os 2 álbuns gravados — melhor custo-benefício!</span>
                                      </div>
                                    </div>
                                    <span className="text-sm font-bold text-orange-700 ml-2 flex-shrink-0">
                                      R$ {COMBO_GRAVADO_PRICE_FULL.toFixed(2).replace(".", ",")}
                                    </span>
                                  </button>
                                </div>
                              );
                            })()}

                            {gravacaoAlbums.length > 0 && albumsOnly.length === 1 && (() => {
                              const gravacaoOffer = gravacaoAlbums[0];
                              const gravacaoSelected = selected.includes(gravacaoOffer.id);
                              const priceNew = parseFloat(gravacaoOffer.priceNew);
                              const priceOld = parseFloat(gravacaoOffer.priceOld);
                              return (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-orange-600 px-1">
                                    🎙️ Disponível em versão gravada:
                                  </p>
                                  <button
                                    onClick={() => toggleAlbum(child.id, gravacaoOffer.id)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                      gravacaoSelected
                                        ? "border-orange-500 bg-orange-50"
                                        : "border-dashed border-orange-400 hover:bg-orange-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        gravacaoSelected ? "border-orange-500 bg-orange-500" : "border-orange-400"
                                      }`}>
                                        {gravacaoSelected && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <span className="text-sm font-medium">🎙️ {gravacaoOffer.name}</span>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      {priceOld > priceNew && (
                                        <span className="text-xs text-gray-400 line-through block">
                                          R$ {priceOld.toFixed(2).replace(".", ",")}
                                        </span>
                                      )}
                                      <span className="text-sm font-bold text-orange-700">
                                        R$ {priceNew.toFixed(2).replace(".", ",")}
                                      </span>
                                    </div>
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                  </div>
                ))}
              </div>

              <button
                onClick={addChild}
                className="w-full py-3 border-2 border-dashed border-primary text-primary rounded-xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                Adicionar outra criança
              </button>

              {/* Resumo do total */}
              {hasSelections && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Resumo:</p>
                  {children.map((c) => {
                    const selected = c.selectedAlbums ?? [];
                    if (!c.name || selected.length === 0) return null;
                    const subtotal = calcularSubtotal(selected, c.albumResult?.found ? (c.albumResult.albums?.length ?? 0) : 0);
                    return (
                      <div key={c.id} className="flex justify-between text-xs text-gray-600">
                        <span>
                          {c.albumResult?.display_name ?? c.name} —{" "}
                          {selected.map((key) => getAlbumLabel(key)).join(" + ")}
                        </span>
                        <span className="font-semibold">
                          R$ {subtotal.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    );
                  })}
                  <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-gray-800">
                    <span>Total</span>
                    <span>R$ {calcularTotal().replace(".", ",")}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Check className="h-3 w-3 text-green-500" />
                <span>Personalização ilimitada para todas as crianças</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-100 p-6 bg-gray-50 rounded-b-3xl">
          <button
            onClick={handleNext}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 px-6 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg"
          >
            <span>
              {step === 2
                ? hasSelections
                  ? `Ir para o Pagamento — R$ ${calcularTotal().replace(".", ",")}`
                  : "Ir para o Pagamento"
                : "Continuar"}
            </span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}