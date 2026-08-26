# Rastreamento Contentsquare + GA4 — o que foi feito (tag `[CS+GA4 2026-08]`)

Todas as alterações estão marcadas no código com o comentário `[CS+GA4 2026-08]`
(`grep -rn "CS+GA4" src/` lista tudo). Build (`astro build`) passa.

## Reconhecimento (resultado)

| Item | Achado |
|---|---|
| Modal de compra do `/` | `src/components/ModalVanilla.astro` — script `is:inline` vanilla, estado `step` (1/2/3) trocado por `goStep(n)`; `Modal.tsx`/`ModalController.tsx` **não** estão em uso em nenhuma página. |
| Assistente `/presente` | `src/components/assistente/AssistenteGuiado.tsx` — estado `tela`: `nome → amostra \| fallback → oferta → familia → (addnome \| relampago) → dados → /pagamento`. |
| Roteamento | **MPA** (não há `<ViewTransitions />` nem `<ClientRouter />`). Seção 4 do guia **não se aplica**; nenhum handler de `astro:page-load` foi adicionado. |
| Tags base | `src/components/AnalyticsHead.astro` já carrega `gtag.js` (`G-JMDLD91HJR`) e `t.contentsquare.net/uxa/143e9890c318e.js`. **Não foi tocado.** `window.gtag` e `window._uxa` existem em runtime (o helper ainda faz guard). |
| `src/lib/tracking.ts` | **Já existia** e é o helper do Meta Pixel/TikTok/CAPI. Por isso o helper novo ficou em `src/lib/analytics-tracking.ts`. `tracking.ts` **não foi alterado**. |

## Arquivos tocados

### 1. `src/lib/analytics-tracking.ts` (novo)
Helper unificado do guia (`trackStep`, `trackCheckout`, `trackAction`, mapa `STEPS`) em TS, com os
nomes/paths **exatamente** como no guia. Extras:
- `slugProduto(nome)` — slug estável p/ `presente_detalhes_produto` (sem acento/PII).
- `exposeOnWindow()` — publica `window.__tcFunnel` para o script `is:inline` do ModalVanilla
  (que não consegue `import`).

### 2. `src/components/ModalVanilla.astro` (landing `/`, também usado por `campanha1`, `pre-venda`)
- `trackModalStep(n)` chamado dentro de `goStep(n)` e em `openModal()` (etapa 1 renderiza ali, sem passar por `goStep`).
  → dispara **no render da etapa**, não no clique; cliques barrados pela validação não contam. Voltar (`tc-back-btn`) re-dispara = nova exibição.
  - step 1 → `modal_lead` / `/modal-compra/1-lead`
  - step 2 → `modal_qtd_criancas` / `/modal-compra/2-quantidade-criancas`
  - step 3 → `modal_nomes_produtos` / `/modal-compra/3-nomes-e-produtos`
- `closeModal(abandonou)`: X, ESC e clique no backdrop chamam `closeModal(true)` → `modal_fechou` + CS `modal-compra|fechou` + pageview `/`.
  O `closeModal(false)` antes do `window.location.href = "/pagamento"` **não** conta como abandono.
- `<script>` bundlado no fim do arquivo: `exposeOnWindow()`. O módulo roda antes de qualquer interação do usuário, então `window.__tcFunnel` já existe quando o modal abre (há guard mesmo assim).
- Nada do Lead/InitiateCheckout (Meta) foi alterado.

### 3. `src/pages/pagamento.astro`
- `<script>` de página chamando `trackCheckout()` → `chegou_checkout` (GA4) uma vez por carregamento real. Único ponto de disparo (MPA).

### 4. `src/components/assistente/AssistenteGuiado.tsx`
- `useEffect([tela])` com o mapa `TELA_STEP`:
  - `amostra` **e** `fallback` → `presente_amostras` (`fallback` = amostra com outro nome, quando o nome não está gravado)
  - `oferta` → `presente_produtos`
  - `familia` → `presente_resumo` (tela com "Fazer pagamento" / "+ Adicionar outra criança")
  - `relampago` → `presente_oferta_relampago`
  - `dados` → `presente_dados` / `/presente/5-dados` **(adicionado na v2 — lead + order bumps; precisa ser criado nos painéis, ver prompts)**
  - `nome` → nada (load real de `/presente`); `addnome` → nada (coberto pela ação abaixo).
- Ações (`trackAction`):
  - "← Trocar o nome" (amostra) e "← Tentar outro nome" (fallback) → `presente_trocar_nome` + CS `presente|trocar-nome` + pageview `/presente`
  - "+ Adicionar outra criança" (resumo) → `presente_adicionar_crianca` + CS `presente|adicionar-crianca` + pageview `/presente`
  - "Não, obrigado" no relâmpago → `presente_oferta_recusou` + CS `presente|oferta-relampago-recusou` + pageview **`/presente`** (a tela que fica visível depois é a de nome, não a de produtos — seguindo a instrução do guia de usar o path da tela seguinte)
  - Botão laranja do relâmpago → `presente_oferta_aceitou` + CS `presente|oferta-relampago-aceitou`
  - Play no `PlayerAmostra` (amostra e fallback) → `presente_play_amostra` + CS `presente|play-amostra` (a cada play, não só o primeiro)
  - Abrir "Ver lista de cantigas" num card → `presente_detalhes_produto` + CS `presente|detalhes-produto|<slug>` + `params.produto=<slug>` (só ao abrir; `colecao-completa` p/ o card da coleção, senão slug do nome do álbum)
  - "Prefiro pedir pelo WhatsApp" (fallback, sem amostra) → `presente_whatsapp` + CS `presente|whatsapp-sem-amostra`
  - "Prefiro comprar com o vendedor" (oferta) → `presente_vendedor` + CS `presente|falar-vendedor`
  - Clique num order bump na tela de dados (`toggleBump`) → `presente_order_bump` + CS `presente|order-bump|<marcou|desmarcou>|<slug>` + `params.produto`, `params.acao` **(v2)**

### 5. `src/components/assistente/AssistentePecas.tsx`
- `PlayerAmostra` ganhou prop opcional `onPlay?: () => void`, chamada dentro do `.play().then()` existente. `onFirstPlay` (ViewContent do Meta) intocado.

## Pontos para o operador decidir (não implementados, fora do guia)

1. ~~Tela `dados`~~ → **resolvido na v2**: etapa `presente_dados` + ação `presente_order_bump`. Os painéis do GA4 e do CS precisam ser atualizados (prompts entregues ao operador).
2. **"Agora não" sem Álbum 1 gravado** (~1% dos nomes): vai direto para a tela de nome, sem evento. Aceito pelo operador.
3. **Botão flutuante do WhatsApp** (canto inferior) no `/presente` e no layout global: sem evento (não listado no guia).
4. **Nome do arquivo**: `src/lib/analytics-tracking.ts` em vez de `tracking.js` (conflito com o helper do Meta já existente).

## Não tocado (Regra 0.2)
`AnalyticsHead.astro`, `PixelHead.astro`, `src/lib/tracking.ts` (Meta/CAPI), `.env`, `astro.config.mjs`, Dockerfile/nginx, `PaymentPage.tsx`, consentimento (não existe CMP/Consent Mode no código — ver QA abaixo).

## QA sugerido (Seção 6 do guia)
- DevTools → Network, filtro `contentsquare`: 1 `POST .../pageview` com `url=<path virtual>` por etapa exibida.
- Filtro `collect`: 1 request com `en=<evento>` por etapa/ação. Ou Realtime/DebugView (`G-JMDLD91HJR`).
- Checar sem duplicidade: abrir modal (1× `modal_lead`), avançar/voltar, fechar com X/ESC/fora (`modal_fechou`), concluir (sem `modal_fechou`, e `chegou_checkout` 1× em `/pagamento`).
- `/presente`: play, detalhes, oferta, resumo, adicionar criança, relâmpago (aceitar/recusar).
- **Consentimento**: não encontrei CMP/Consent Mode neste repositório — o `gtag('config')` roda direto no `AnalyticsHead`. Se o consentimento estiver em outra camada (GTM/servidor/nginx), testar com ele concedido e negado como o guia pede.
