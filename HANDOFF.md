# Handoff — Meu Hub

Data: 2026-11-10
Estado: **M0–M5 concluídos + iteração de Biblioteca/feed + Sprint 0 (baseline) + Sprint 1 (P0 de UX)**. Projeto local, funcional e com testes verdes.

## 1. O que é

Hub pessoal local que roda no navegador como página inicial:

- Links e apps do PC organizados em categorias/grupos.
- Feed de RSS/Atom, Reddit e YouTube com filtro por palavra-chave.
- Busca rápida (Ctrl K), leitura/salvamento de posts e visualizações Bento/Compacto/Completo.
- Dados em JSON local, com exportar/importar e possibilidade de pasta sincronizada (Drive/OneDrive).

Sem login, sem versão online, tema escuro único, servidor apenas em `127.0.0.1`.

## 2. Como rodar

```powershell
npm install
Copy-Item data\hub.example.json data\hub.json   # só na primeira vez
npm run dev                                     # http://127.0.0.1:5757
```

Produção:

```powershell
npm run build
npm start
```

`npm start` força `HOST=127.0.0.1` e `PORT=5757`. `.env` opcional (veja `.env.example`):

| Variável       | Padrão      | Função                                       |
| -------------- | ----------- | -------------------------------------------- |
| `HOST`         | `127.0.0.1` | interface de rede                            |
| `PORT`         | `5757`      | porta                                        |
| `HUB_DATA_DIR` | `data`      | pasta dos JSON (pode ser pasta sincronizada) |

## 3. Stack

- SvelteKit 3 + Svelte 5 (runes) + TypeScript.
- `@sveltejs/adapter-node`, Vite, Vitest, ESLint/Prettier.
- Zod (validação), Fuse.js (busca), fast-xml-parser (feeds).
- Node 24+ (`engines` no `package.json`).

## 4. Arquitetura

```
src/
  app.css                      # tokens e estilos (tema escuro)
  app.html                     # fontes Inter/Space Grotesk
  hooks.server.ts              # allowlist de Host/Origin
  lib/
    types.ts                   # HubData, HubState, FeedItem, FeedCache...
    schema.ts                  # Zod + referências quebradas/ids duplicados
    defaults.ts                # EMPTY_HUB compartilhado
    display.ts                 # iniciais, tint, tempo relativo, href
    hub-edit.ts                # mutações puras do hub
    hub-actions.ts             # dispatcher testável de ações da API
    search.ts                  # índice Fuse + entradas de busca
    ui.svelte.ts               # estado global da paleta Ctrl K
    storage/
      json-file.ts             # escrita atômica, backup, import/export
      index.ts                 # fábrica do storage
    feed/
      parse.ts                 # RSS/Atom -> FeedItem, imagens, limpeza
      filter.ts                # regras include/exclude e destaque
      sources.ts               # URLs de Reddit/YouTube/RSS
      refresh.ts               # fetch resiliente + cache por fonte
      scheduler.ts             # atualização periódica
      discover.ts              # descoberta de RSS em página HTML
      view.ts                  # junta cache+estado em itens de tela
    net/safe-fetch.ts          # fetch público com proteção SSRF/limite
    actions/masonry.ts         # layout masonry absoluto do Bento
    components/                # Sidebar, TopBar, FeedBoard, FeedCard, editor...
  routes/
    +layout.server.ts          # hub + estado + cache do feed
    +layout.svelte             # shell, sidebar, palette, skip link
    +page.svelte               # Início
    c/[slug]/                  # categoria
    feed/ favoritos/ biblioteca/ apps/ gerenciar/
    api/                       # hub, feed, refresh, state, export, import, discover-feed
data/
  hub.example.json             # seed versionado
  hub.json                     # dados reais (ignorado pelo Git)
  estado.json                  # lidos/salvos + snapshot dos salvos (ignorado)
  feed-cache.json              # posts + status por fonte (ignorado)
```

## 5. Dados e persistência

- Toda leitura/escrita passa por `JsonFileStorage`.
- Escrita atômica: arquivo temporário + `rename`.
- Backup `.bak` só é atualizado quando o arquivo atual é válido.
- Se `hub.json` estiver inválido, o layout usa `hub.json.bak` e mostra banner com os problemas.
- `importBundle`:
  - `replace`: substitui hub e estado.
  - `merge`: mescla por `id`; usa backup se o hub atual estiver inválido; aborta se não houver backup.
- Schema valida: ids duplicados, referências de categoria/grupo, consistência grupo↔categoria, URLs http(s), protocolos seguros.
- `data/hub.json`, `estado.json`, `feed-cache.json` e `*.bak` são ignorados pelo Git.

## 6. Funcionalidades implementadas

### Navegação e layout

- Sidebar esquerda **sticky** (100vh, rolagem interna), rodapé fixo com Gerenciar e engrenagem no cabeçalho; responsiva.
- Início: **painel geral** com 3 cards (Acesso rápido, Resumo do dia, Ações rápidas), só as **5 últimas notícias** e “Ver feed completo”; barra direita fixa com Fontes, Filtros salvos, Salvos recentemente e Nota rápida.
- Category: grupos, links/apps e feed da categoria.
- Feed, Favoritos, Biblioteca e Gerenciar.
- **Feed completo**: cabeçalho com total no cache, fontes ativas e última atualização; lista de fontes com estado ativa/desligada.
- **Favoritos**: lista focada nos posts salvos, com contador, busca local e ordenação por **salvos/publicados**; sem atalhos ou filtros duplicados. A sidebar mostra um badge com a quantidade de salvos.
- **Biblioteca**: abas **Todos / Apps do PC / Navegador**, busca local e organização por **categoria → grupo**. Cada categoria é um **acordeão** com estado salvo no navegador, botão **Recolher/Expandir tudo** e expansão automática durante a busca. A sidebar mostra `itens · fontes` por categoria. Um grupo reúne links e apps do mesmo assunto (ex.: jogo = app Steam + builds + wiki + subreddit). Itens sem grupo caem em “Sem grupo”. Links usam favicon e apps usam ícone do protocolo, com fallback para iniciais; `icon` opcional sobrescreve. `/apps` redireciona para `/biblioteca`.

### Acesso rápido

- É **manual**: itens com `pinned: true`.
- Definido em Gerenciar → Links/Apps → Editar → “Fixar no acesso rápido da home”.
- Na home, aparece no **card “Acesso rápido”** no topo (grade compacta de 2 colunas, até 6 itens), não mais na barra direita.
- Não há rastreamento de uso.

### Busca Ctrl K

- Paleta com Fuse.js sobre itens e categorias.
- Ignora acento, tolera erro de digitação, navega com setas, Enter abre, Esc fecha.
- Links abrem em nova aba; apps disparam o protocolo.

### Feed

- Fontes: RSS/Atom (URL), Reddit (subreddit ou `.rss`), YouTube (ID `UC...` ou URL de feed).
- Refresh: timeout 10 s, User-Agent, limite de 5 MB, 30 posts/fonte por padrão (limite configurável por fonte), retenção 30 dias, dedupe por URL/guid.
- Scheduler a cada ~60 s (só fontes vencidas) + “Atualizar agora”.
- Falha de uma fonte não afeta as outras; status e erro aparecem em Gerenciar/Feed.
- Regras por fonte (`include`/`exclude`/`matchMode`) aplicadas sobre título+resumo, sem acento/caixa.
  - Filtro ao vivo: palavra-chave, qualquer/todas, filtros salvos com contagem, chips de categoria, “Não lidos”, destaque do termo.
  - **+ Salvar filtro** abre um formulário em linha com **Nome, Incluir, Excluir e Modo**, já preenchido com a busca/filtro atual, e grava no `hub.json`.
  - Ações: abrir, salvar para depois, marcar como lido — ícones (link externo, bookmark, check) com tooltip/`aria-label`; “marcar tudo como lido” respeita o filtro.
  - **Vídeos do YouTube**: thumbnail com botão ▶; clique abre player em modal (`youtube-nocookie`, autoplay), sem afetar o masonry; fecha por Esc, botão ou backdrop e oferece “Abrir no YouTube”. O ID é extraído da URL ou da thumbnail, então funciona também em Favoritos/snapshots.
  - **Vídeos do Reddit**: thumbnail com selo Reddit; no clique, `/api/reddit-media` consulta o embed oficial e detecta vídeo. Se for vídeo, abre o player do Reddit em modal; senão, mantém o lightbox de imagem. Cache em memória de 10 min. Não usa JSON do Reddit nem extração de MP4/HLS.
  - **Idioma por fonte Reddit**: interruptor “Exibir em inglês” no editor. Ligado grava `locale: "en"` e envia `locale=en` ao embed; desligado não envia locale (navegador). O snapshot de salvos preserva o locale.
  - **Imagens**: thumbnail abre lightbox com a imagem, título e atalhos “Abrir imagem”/“Abrir publicação”; fundo escuro e fechamento por Esc, botão ou backdrop.
- Contadores de não lidos na sidebar e nas fontes.
- Imagens: `enclosure`, `media:content`, `media:thumbnail`, `media:group`, primeiro `<img>` do HTML e thumbnail do YouTube (normaliza URLs antigas).
- Resumos: até 700 caracteres, entidades numéricas decodificadas e boilerplate do Reddit removido.
- Ordenação: sempre por data, mais recente primeiro.

### Visualizações do feed

- **Bento** (padrão): masonry de **colunas iguais**.
  - 2 colunas com painel aberto; 3 quando o feed tem ≥1000 px; 1 abaixo de 620 px.
  - Posicionamento absoluto: cada card vai para a coluna mais curta, sem buracos.
  - Imagens 3:2; se a imagem for retrato, proporção real limitada entre 0,7 e 1,6.
  - Altura natural; texto sem corte de linhas.
  - Recalcula com ResizeObserver (imagens/filtros) e MutationObserver (novos cards).
- **Compacto**: imagem (ou placeholder 96×72 com o nome da fonte), meta, título em até 2 linhas e ações; **sem excerpt**.
- **Completo**: mesma lista do Compacto, com imagem lateral maior, resumo em ~4 linhas e botão **Expandir/Recolher** apenas quando o texto realmente transborda (medido via `scrollHeight`/`clientHeight`).
- A escolha fica em `localStorage` (`meu-hub:feed-view`); `grid` antigo migra para `completo`.
- A barra direita da home é **fixa/sticky, sem recolher**, com Fontes do feed, Filtros salvos (com contagem e link para `/feed?filtro=id`), Salvos recentemente e Nota rápida.
- **Animações**: cards saem com fade, os restantes deslizam para a nova posição (CSS `left/top/width` no Bento e FLIP no Compacto/Completo). **Não anima ao entrar/trocar de página nem ao trocar de visualização**: `viewReady` evita o salto de visualização e `animationsEnabled` só liga após ~400ms; depois vale para filtros, busca, lidos e “Carregar mais”. Respeita `prefers-reduced-motion`.

> Histórico: tentamos Bento com larguras mistas (1/3, 1/2, 2/3). Foi abandonado porque masonry com spans variados abre buracos e os spans mudavam ao filtrar/marcar como lido. Colunas iguais resolveram.

### Gerenciar / edição

- Abas funcionais: Fontes, Itens, Grupos, Categorias, Filtros salvos, Aparência.
- **Itens** unifica Links e Apps, com subchips Todos/Links/Apps, busca local e agrupamento por categoria → grupo.
- Busca local em todas as listas (fontes, itens, grupos, categorias e filtros).
- Painel lateral com `<dialog>` nativo (foco, Esc, backdrop), **cabeçalho/rodapé fixos**, formulário em seções compactas e preview do ícone.
- Adicionar/editar/remover:
  - Links e apps (descrição curta, ícone, tags e acesso rápido).
  - Grupos (nome + categoria; mudar de categoria move junto os itens e fontes do grupo; remover bloqueia se tiver itens ou fontes).
  - Fontes (tipo, alvo, categoria, grupo, intervalo, **limite de posts**, include/exclude, liga/desliga).
  - Categorias (nome/cor, remover se não estiver em uso).
  - Filtros salvos (adicionar/editar/remover), com Incluir, Excluir e Modo.
  - Aparência: cor de destaque do tema.
- **Atualizar esta fonte** por linha, sem esperar o scheduler nem atualizar as demais.
- Reordenar itens, grupos e categorias com ↑/↓ (ícones).
- Remoção com diálogo próprio no tema escuro.
- Detecção automática de RSS pela URL da página.
- Toda mutação passa por `hub-actions.ts` → mutação pura → `parseHub` → `saveHub`.

### Exportar/importar

- `GET /api/export`: download `hub-export-AAAA-MM-DD.json` (hub + estado).
- `POST /api/import`: valida, resume, substituir ou mesclar, com backup.
- Tela Gerenciar tem o fluxo completo com confirmação.

### Segurança

- Servidor em loopback + allowlist de Host/Origin (`hooks.server.ts`).
- CSRF nativo do SvelteKit para POSTs de formulário.
- Protocolos perigosos (`javascript:`, `data:`, `vbscript:`, `file:`) rejeitados.
- Descobridor de feeds usa `fetchPublicText`:
  - bloqueia loopback/redes privadas/link-local;
  - redirecionamentos manuais revalidados;
  - limite de 5 MB por streaming;
  - apenas http(s) e tipos de conteúdo permitidos.
- Sem execução de comandos livres.

## 7. Decisões importantes

- SvelteKit 3 removeu `$lib`; usamos `#lib` com paths no `tsconfig`.
- `data/hub.json` é dado pessoal e não entra no Git; `hub.example.json` é o seed.
- UI em pt-BR; identificadores em inglês.
- Acesso rápido é manual (`pinned`), não por frequência.
- Feed sempre ordenado por data.
- Bento = masonry de colunas iguais (não larguras mistas).
- Preferência de visual e painel ficam no navegador, não no `hub.json`.
- Modal usa `<dialog>` nativo (o `inert` manual congelava o próprio painel).

## 8. Qualidade e verificação

```powershell
npm run verify  # check + lint + testes + build
npm test        # 283 testes
npm run check   # svelte-check
npm run lint    # Prettier + ESLint
npm run build
npm audit --omit=dev
```

Estado no handoff: **283/283 testes, 34 arquivos de teste, 0 erros/avisos no check, lint limpo, build ok, 0 vulnerabilidades de produção**.
O `npm audit` completo ainda mostra avisos de dependências de desenvolvimento (ESLint); não afetam o runtime.

## 9. Commits (histórico)

```
d6358c3 chore: scaffold SvelteKit project and organize mockups
102d7be feat(lib): hub types and zod schema with reference validation
8d8294f feat(data): json-file storage, api/hub route and seed hub.json from mockups
e8066b2 feat(m1): dark theme UI, home, category and placeholder pages
1e086fc chore: ignore local storage backups
95882c9 fix: harden storage backup, schema refs, protocols and host allowlist
bab1381 feat(m2): Ctrl K search, export/import and UX polish
513325e feat(feed): pure keyword filter and highlight logic
2b5591b feat(feed): normalize RSS and Atom feeds
2c80d0e feat(feed): source URLs and resilient refresh with per-source cache status
2a7bedd feat(feed): feed/refresh/state APIs and periodic scheduler
d5db22d feat(feed): feed board, cards, live filters, read/saved actions and source status
f61fa8c feat(m3): feed UI, read/saved state, source status and docs
b1bae0c feat(edit): pure hub mutations for items, sources, categories and filters
aae59a4 feat(feed): RSS/Atom autodiscovery from a page URL
525d034 feat(edit): hub mutation and feed discovery APIs
6572281 feat(edit): manage tabs, editor drawer, toggle/edit/remove/reorder and add forms
cd6c118 docs: document M4 editing panel and new APIs
3d44fe6 feat(edit): rename, recolor and reorder categories
b1a5a08 chore(m5): touch targets, engines, shared defaults and extra storage tests
112d5b3 chore(m5): split versioned hub.example.json from personal hub.json
eeeeccb fix(m5): review fixes for reorder, source groups, action wiring and SSRF
e2026b1 chore(m5): point edit affordances to Gerenciar and drop stale V2/V3 copy
5b691e0 fix(edit): use native modal dialog so the editor is not inert
9ccfe3f feat(feed): extract images from media:group, HTML and YouTube links
22814db feat(feed): masonry action with tested span calculation
3fc8ce4 feat(feed): bento, compact and grid views with masonry and collapsible panel
733fa2b feat(feed): normalize YouTube thumbnails and document feed views
de0c3ec feat(feed): bento mosaic with varied spans, 3:2 images and portrait awareness
19ad9da feat(feed): rename bento to equal-column masonry and clean feed summaries
```

## 10. Limitações conhecidas / pendências

- **Concorrência**: duas escritas simultâneas usam “última vence”; não há fila/otimistic lock.
- **Importação**: `bundle.state` não é validado antes de gravar o hub; um estado malformado pode deixar import parcial.
- **Proxy de rede**: o `fetch` do Node não lê `HTTPS_PROXY` automaticamente; redes com proxy podem falhar no feed.
- YouTube aceita `@handle`, URL do canal, ID `UC...` ou URL de feed; o ID é resolvido automaticamente no refresh e pelo botão **Detectar**.
- Fontes de feed não têm reordenação (modelo não tem `order`).
- `npm audit` completo tem avisos em dependências de desenvolvimento (ESLint).
- O feed é sempre por data; não há ordenação alternativa.

## 11. Próximos passos sugeridos

1. Fila de escrita/otimistic lock no storage.
2. Validar `bundle.state` antes de importar.
3. Suporte a proxy (`HTTPS_PROXY`) no refresh/discover.
4. Revisão de acessibilidade do masonry (ordem visual x DOM já é preservada).
5. Testes de componente/e2e para as visualizações e para a Biblioteca.
6. Página própria por grupo (`/g/[slug]`) com feed do grupo, se necessário.

## 12. Notas para o próximo agente

- Rode `npm test` antes e depois de qualquer mudança.
- Faça commits pequenos por fase.
- Não reintroduza `inert` no `.app-shell`; o modal é um `<dialog>` nativo.
- O Bento usa posicionamento absoluto via `use:masonry`; se mudar o DOM, garanta que os cards sejam filhos diretos de `.feed-layout`.
- Ao mexer no parser, rode os testes de `parse.test.ts` (entidades, imagens, YouTube, Reddit).
- Dados pessoais: nunca comite `data/hub.json`, `estado.json` ou `feed-cache.json`.

## 13. Sprint 0 — baseline e preparação

Executado em 10/11/2026 sobre o commit `d799914`.

- Tag de baseline: **`v0.6.0`**.
- Backup completo de `data/` em `data/backups/sprint-0-20261110-114313/` (ignorado pelo Git).
- `data/backups/` adicionado ao `.gitignore`.
- Script local **`npm run verify`** (check + lint + testes + build).
- Baseline: 5 categorias, 8 grupos, 31 itens, 4 fontes, 51 posts no cache, 2 salvos, 18 arquivos de teste, **172 testes**, 2.176 linhas de CSS.
- Plano completo versionado em [`PLANO-EXECUCAO.md`](PLANO-EXECUCAO.md).
- Decisões e baseline em [`docs/sprint-0.md`](docs/sprint-0.md).
- Checklist manual em [`docs/checklist-regressao.md`](docs/checklist-regressao.md).

Decisões principais: busca inclui posts na palette; terminologia **Favoritos**/“Salvar para depois”/“Biblioteca”/“Fontes”; notas em `notes.json`; reader mode adiado; sync por pasta; autostart via Startup; LAN só `127.0.0.1`; tema somente dark; retenção de lidos 90 dias; backups 7 gerações; SQLite só no critério; CSP com allowlist para YouTube/Reddit/fontes/imagens; migração versionada só para mudanças quebrantes; CI local via `npm run verify`.

Próximo: Sprint 1 — P0 de UX, conforme o plano versionado.

## 14. Sprint 1 — P0 de UX

Executado em 10/11/2026 sobre o Sprint 0.

- Título clicável nas três visões, posts na palette, deep links de adicionar, foco de grupo.
- Métricas/fontes da home clicáveis; filtros `?fonte=` e `?nao-lidos=1`.
- Fontes com erro só ativas; cache limpo ao mudar `target`/`type` ou remover fonte.
- Busca de salvos com resumo e destaque no resumo.
- Confirmação + desfazer em “marcar tudo como lido”; lote persistido em `sessionStorage` por 30 s, sobrevive a reload e tem botão no cabeçalho e no toast.
- Palette com focus trap, clique fora, scroll lock e retorno de foco.
- Switch de fonte com semântica de switch; editor com aviso de descarte.
- Terminologia unificada, contraste melhorado, favicon e textos de filtro corrigidos.
- `npm run verify` verde com **177/177 testes**.

Detalhes em [`docs/sprint-1.md`](docs/sprint-1.md). Próximo foco: segurança (SEC-01, SEC-03, SEC-04, SEC-05) e depois CSP com allowlist de iframes/imagens.

## 15. Fase de segurança

Executada em 10/11/2026 sobre `v0.7.1`.

- **SEC-01**: allowlist `http(s)` para links de feed, thumbnails e snapshots; parser e `/api/state` rejeitam esquemas perigosos.
- **SEC-03**: Zod para `HubState`, `FeedCache`, `FeedItem` e snapshots; load tenta `.bak` e avisa no layout; import valida `bundle.state` antes de gravar.
- **SEC-04**: `readJsonLimited` com 2 MB para hub/state, 10 MB para import e 64 KB para APIs pequenas; excesso retorna 413.
- **SEC-05**: refresh usa `fetchPublicText`, bloqueando loopback/IP privado, validando redirects e limitando a 5 MB.
- **SEC-02**: headers de segurança + CSP em **Report-Only** com allowlist para YouTube, Reddit, Google Fonts e imagens.
- Teste real: SSRF para `127.0.0.1` bloqueado; snapshot inválido 400; corpo de 2,1 MB 413.
- `npm run verify` verde com **201/201 testes**.

Detalhes em [`docs/security.md`](docs/security.md). Pendências: CSP enforce, nonce/hash para scripts, fontes/ícones locais e DATA-01/DATA-02.

## 16. Fase de dados

Executada em 10/11/2026 sobre `v0.8.0`.

- **DATA-01**: `Mutex`/`createLockRegistry` por arquivo e `updateHub`/`updateState`/`updateFeedCache`/`updateHubAndCache`; APIs de hub/state usam read-modify-write sob lock. Testes com 10 operações concorrentes.
- **DATA-02**: `refresh-runner` coalesce refresh global e por fonte; scheduler e `/api/refresh` compartilham a mesma execução.
- **DATA-04**: `writeFileAtomically` com temporário único, retry de `rename` (EPERM/EBUSY/EACCES), fallback `copyFile` e limpeza em `finally`.
- **DATA-05**: poda de leituras > 90 dias (exceto salvos) e snapshots órfãos; `lastPrunedAt`.
- **DATA-06**: remoção/troca de fonte limpa o cache na mesma transação; cache inválido aborta antes de gravar o hub.
- **DATA-08**: preview de importação com diff por coleção e escolha de settings no merge; padrão agora é manter.
- **DATA-09**: 7 gerações de `.bak`, fallback entre gerações, “Backup agora” datado e idade no Gerenciar.
- **DATA-10**: `loadHubWithFallback` na interface; layout não conhece a implementação.
- Teste real: 10 leituras concorrentes preservadas, backup manual criado, preview do próprio export limpo, fonte temporária removida com cache consistente e nenhum `.tmp-*`.
- `npm run verify` verde com **283/283 testes**.

Detalhes em [`docs/data.md`](docs/data.md). Adiados: DATA-03 (progresso por fonte/SSE) e DATA-07 (migrações, schema ainda em `version: 1`).

### Pontos de restauração (v0.10.0)

- `GET /api/backup` lista `manual-*` com data, caminho absoluto, arquivos e tamanho.
- `POST /api/backup/restore` valida o ponto, cria um ponto de segurança do estado atual e restaura hub/estado/cache.
- `GET /api/backup/download/[id]` baixa o ponto como JSON importável.
- Gerenciar mostra a lista com **Copiar caminho**, **Baixar** e **Restaurar**; restaurar pede confirmação e recarrega.
- Retenção: 10 pontos manuais mais recentes.

### Correção pós-fase: “Backup agora” com 403

O botão fazia `POST /api/backup` sem corpo; o SvelteKit tratava como formulário e o CSRF respondia 403 em texto puro, quebrando o `response.json()`. Agora o botão envia `content-type: application/json` + `{}` e usa `readJsonResponse` para mostrar o status real. POST vazio continua bloqueado de propósito. Detalhes em [`docs/data.md`](docs/data.md#nota-sobre-csrf-em-posts).
