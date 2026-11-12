# Handoff — Meu Hub

Data: 2026-11-11
Estado: **M0–M5 concluídos + iteração de Biblioteca/feed + Sprint 0 (baseline) + Sprint 1 (P0 de UX) + segurança + dados + triagem/seleção em massa + captura rápida + organização manual + PWA/autostart + tags como filtro (v0.17.0) + correções da revisão de código (v0.18.0)**. Projeto local, funcional e com testes verdes. **v0.19.0 a v0.28.0 entregues e a validação da v0.28.0 concluída (automação + manual) em 12/11/2026.**

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
npm test        # 317 testes
npm run check   # svelte-check
npm run lint    # Prettier + ESLint
npm run build
npm audit --omit=dev
```

Estado no handoff: **317/317 testes, 36 arquivos de teste, 0 erros/avisos no check, lint limpo, build ok, 0 vulnerabilidades de produção**.
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
- Fontes de feed têm `order` opcional; DnD de grupos/categorias/fontes ainda não entrou (↑/↓ cobre).
- `npm audit` completo tem avisos em dependências de desenvolvimento (ESLint).
- O feed é sempre por data; não há ordenação alternativa.

## 11. Próximos passos sugeridos

Próximo bloco definido: **leitura (READ-01/02)** — reader mode e highlights/notas.

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

### Aba Backups e exclusão (v0.11.0)

- A área de backups virou aba própria (`/gerenciar?tab=backups`), com contador e sem poluir o cabeçalho.
- `DELETE /api/backup/[id]` remove um ponto manual; id inválido/inexistente retorna 400.
- A lista ganhou **Excluir** com `ConfirmDialog`; `.bak` automáticos não são tocados.
- Escritas usam `content-type: application/json` também no DELETE (CSRF do SvelteKit).
- `npm run verify` verde com **287/287 testes**.

### Correção pós-fase: “Backup agora” com 403

O botão fazia `POST /api/backup` sem corpo; o SvelteKit tratava como formulário e o CSRF respondia 403 em texto puro, quebrando o `response.json()`. Agora o botão envia `content-type: application/json` + `{}` e usa `readJsonResponse` para mostrar o status real. POST vazio continua bloqueado de propósito. Detalhes em [`docs/data.md`](docs/data.md#nota-sobre-csrf-em-posts).

## 17. Fase 2 — triagem do feed

Executada em 10/11/2026 sobre `v0.11.0`.

- **ORG-07**: `countUnread` calcula não lidos por categoria/fonte; Sidebar mostra badge por categoria e os chips do feed mostram contagem.
- **ORG-13**: linha de chips de fonte (com “Todas”), filtrada pela categoria, com não lidos por fonte.
- **ORG-08**: “Marcar antigos” com 1/3/7 dias sobre a visão atual, confirmação e desfazer em 30 s.
- **ORG-10**: filtros salvos com `categoryId`, `sourceId` e `unreadOnly` opcionais; validação de referências; formulário rápido e editor do Gerenciar; remoção de fonte/categoria limpa o escopo.
- Sem migração: campos opcionais e hub antigo continua válido.
- `npm run verify` verde com **301/301 testes**.

Detalhes em [`docs/triage.md`](docs/triage.md).

### Correção v0.12.1 — contagens e cache órfão

- Sidebar calcula não lidos a partir de `buildFeedView` (mesma visão do feed), não do cache bruto.
- `pruneOrphanFeedCache` remove itens/status de fontes removidas ao carregar o layout.
- No servidor real: cache de 26 → 16 posts e contador da sidebar de 11 → 1, coerente com o feed.
- “Marcar antigos” validado com um post real de 21/10: cálculo → marcar → desfazer → estado restaurado.
- `npm run verify` verde com **303/303 testes**.

## 18. Fase 2 — seleção em massa e teclado

Executada em 10/11/2026 sobre `v0.12.1`.

- **ORG-01**: modo de seleção com checkbox por card, shift+clique para intervalo, barra com lido/não lido, salvar/remover, selecionar todos os filtrados e limpar.
- Backend `/api/state` ganhou `save-many` (snapshots validados em conjunto) e `unsave-many`.
- **ORG-09**: `j`/`k` navegam, `m` lê, `s` salva, `o`/`Enter` abrem, `?` mostra ajuda e `Esc` sai da seleção.
- Card focado ganha outline e scroll; atalhos ignorados em campos de texto, modais e palette.
- Novo `ShortcutHelp.svelte` com a lista de teclas.
- Teste real via Edge/CDP: 10 checkboxes, clique + shift = 3 selecionados, barra completa, ajuda abria, `j` focava card e “Limpar” zerava.
- API em lote: `save-many` + `unsave-many` restauraram a contagem de salvos.
- `npm run verify` verde com **317/317 testes**.

Detalhes em [`docs/bulk.md`](docs/bulk.md).

### Correção v0.13.1 — checkbox e foco

- Checkbox nativo trocado por `<button role="checkbox" aria-checked>` com ícone; o visual agora acompanha o estado.
- Superfície clicável cobre o card em modo de seleção: qualquer clique seleciona, com shift para intervalo.
- `keyboardId` só é definido por `j`/`k`; qualquer `pointerdown` limpa, eliminando a borda azul presa.
- Validado via Edge/CDP: 1 → 3 (shift) → 2 selecionados, checkboxes sincronizados e outline removido após mouse.

### Correção v0.13.2 — shift redefine o intervalo

- `updateSelection` agora **substitui** a seleção pelo intervalo âncora→clique, em vez de somar.
- Shift no meio de uma seleção maior desmarca o que ficou fora.
- Testes: `[0]` → shift 4 → `[0..4]` → shift 2 → `[0,1,2]` → shift 4 → `[0..4]`; clique normal alterna só o item.
- Funciona no sentido inverso e com âncora ausente (fallback toggle).

## 19. Fase 2 — captura rápida (v0.14.0)

Executada em 11/11/2026 sobre `v0.13.2`.

- **ORG-04**: **Importar favoritos/OPML** em Gerenciar, com detecção de formato, preview, merge sem duplicatas e **Exportar OPML/favoritos**.
  - Pasta de 1º nível → categoria; subpastas → grupo (`A / B`); raiz → `Importados` / `Feeds importados`.
  - Categoria fixa opcional no diálogo; nomes existentes são reutilizados sem diferenciar caixa/acentos.
  - Bookmark importado recebe `tags: ['importado']`; feeds entram com 30 min e habilitados.
  - Arquivos limitados a 10 MB; URLs só `http(s)`; parser linear com limite de profundidade e itens inválidos listados no preview.
  - Exportar favoritos gera `ihub-bookmarks.html` (Netscape) e reimporta sem perda de nomes/pastas.
- **ORG-05**: **Adicionar rápido** na sidebar (URL + metadados) e **bookmarklet** “Salvar no Hub” na aba Itens.
  - `/api/link-metadata` extrai título, descrição e ícone via `fetchPublicText` (SSRF, timeout 5 s, 1 MB).
  - Falha de metadados não bloqueia: o editor abre só com a URL.
  - Bookmarklet abre `/gerenciar?tab=itens&add=link&url=...&name=...`.
  - Os parâmetros do deep link são aplicados por efeito reativo, então funcionam mesmo quando o Gerenciar já está aberto.
- APIs novas: `POST /api/import/file/preview`, `POST /api/import/file/apply`, `GET /api/export/opml`, `GET /api/export/bookmarks`, `POST /api/link-metadata`.
- `npm run verify` verde com **380 testes** em 49 arquivos.
- Detalhes em [`docs/capture.md`](docs/capture.md).

### Revisão pós-implementação

- Revisão independente apontou e foram corrigidos:
  - parser de bookmarks quadrático com tags `<A>` sem fechamento → scanner linear + caps (100k itens, profundidade 50);
  - quick add não abria o editor quando o Gerenciar já estava aberto → parâmetros tratados por `$effect` reativo;
  - merge O(n²) → helpers `addLinks`/`addSources` em lote;
  - export de bookmarks HTML ausente → `GET /api/export/bookmarks` + `buildBookmarksHtml`;
  - inválidos silenciados → preview e diálogo listam motivo, limitado a 20;
  - testes de truncamento, profundidade, performance e host privado adicionados.
- Validação real no Edge/CDP: quick add a partir de `/gerenciar`, bookmarklet arrastável e diálogo de importação com input de arquivo.
- Branch `feat/captura-rapida`; tag local `v0.14.0`; nenhum push.
- `core.autocrlf` local foi definido como `false` para o `lint` não falhar em todos os arquivos por CRLF.

## 20. Fase 2 — organização manual (v0.15.0)

Executada em 11/11/2026 sobre `v0.14.0`.

- **ORG-16**: `FeedSource.order` opcional, normalizado no `parseHub` (fontes antigas recebem a posição atual).
  - `addSources` coloca novas fontes no fim da categoria.
  - `moveSource` troca com a vizinha da mesma categoria; ↑/↓ em Gerenciar → Fontes.
  - Listas de fontes ordenadas na home, feed, categoria e seletor de filtros.
- **ORG-02**: DnD de itens em Gerenciar → Itens.
  - Handle **⋮⋮** por linha; drop em outro grupo/“Sem grupo”.
  - Durante o arraste, todos os grupos (inclusive vazios) e um “Sem grupo” por categoria aparecem como destino.
  - `moveItemTo` atualiza `categoryId`/`groupId` e põe o item no fim do grupo; ação `move-item-to`.
  - Destaque da drop zone; fallback por ↑/↓, editor e mobile.
  - Fora do bloco: DnD de grupos/categorias/fontes.
- Revisão pós-implementação corrigiu:
  - drop targets escondidos por busca/filtro/grupo vazio → todos aparecem durante o arraste;
  - ordem de fonte não recalculada ao mudar de categoria → `updateSource`/`updateGroup` reatribuem para o fim da categoria destino;
  - testes de mudança de categoria e grupo adicionados.
- `npm run verify` verde com **399 testes** em 52 arquivos.
- Edge/CDP: item movido de Darktide para Risk of Rain Returns e fonte r/Darktide ↔ Steam News; ambos persistidos no `hub.json`.
- Detalhes em [`docs/organization.md`](docs/organization.md).
- **Validação manual do dono (11/11/2026): aprovada** — DnD entre grupos/“Sem grupo” e reordenação de fontes conferidos com o servidor em `127.0.0.1:5757`.

## 21. Fase 4 — PWA e autostart (v0.16.0)

Executada em 11/11/2026 sobre `v0.15.0`.

- **PLAT-01**: manifest (`static/manifest.webmanifest`), ícones 192/512 (any + maskable), `offline.html`, service worker e registro em produção.
  - SW faz network-first para navegação com fallback offline e cache-first apenas para `/_app/immutable`, `/icons`, manifest e favicon.
  - Nunca intercepta `/api/`, métodos não-GET ou outra origem.
  - CSP ganhou `worker-src 'self'` (Report-Only).
- **PLAT-02**: `scripts/install-autostart.ps1`, `scripts/uninstall-autostart.ps1` e `scripts/start-hidden.vbs`.
  - Atalho por usuário na pasta Startup, sem admin, com janela oculta.
  - Instalação/remoção testada em pasta Startup temporária; **não foi instalado no Windows do dono**.
  - Validação real de logon fica pendente (instalar, sair/entrar e abrir `127.0.0.1:5757`).
- `npm run verify` verde com **414 testes** em 55 arquivos.
- Edge/CDP: `Page.getInstallabilityErrors` vazio, SW `activated`/controlando, cache `meu-hub-shell-v1`; com rede e cache HTTP desligados, navegação serviu “Meu Hub está offline”.
- Revisão pós-implementação corrigiu:
  - autostart silencioso → `start.mjs` valida build/porta, grava `data/autostart.log` e instala com aviso de porta ocupada;
  - teste do atalho só verificava existência → agora confere target/arguments/workdir em caminho com espaços;
  - `npm run setup` adicionado para `.env` e `data/hub.json`.
- Detalhes em [`docs/pwa.md`](docs/pwa.md).
- Branch `feat/pwa-autostart`; tag `v0.16.0`; as branches `feat/captura-rapida` e `feat/organizacao-manual` continuam empilhadas e ainda não foram integradas ao `master`.
- **Próximo passo:** ORG-03 — tags como filtro de primeira classe (chips na Biblioteca, URL `?tag=`, renomear tag em massa e normalizar duplicatas).

## 22. Fase 2 — tags como filtro (v0.17.0)

Executada em 11/11/2026 sobre `v0.16.0`.

- **ORG-03**: tags normalizadas e filtro de primeira classe.
  - `src/lib/tags.ts`: chave sem caixa/acento/espaço, dedupe preservando a primeira grafia, contagem, teste de tag e rename em massa.
  - `parseHub` normaliza tags no load; add/update item normaliza ao salvar.
  - Biblioteca: chips com contagem, “Todas”, combinação com busca/tipo/categoria e URL `?tag=...` (sobrevive a reload).
  - Gerenciar → Tags: lista com contagem e renomeação por linha; destino existente é mesclado; vazio é rejeitado; remoção em massa com confirmação.
  - Editor de item sugere tags existentes (datalist).
  - Ação `rename-tag` e `remove-tag` no `/api/hub`.
- `npm run verify` verde com **440 testes** em 58 arquivos.
- Edge/CDP: `build · 2` filtrou para 2 itens, URL `?tag=build` persistiu no reload e Voltar/Avançar restaurou os filtros; renomear `build` → `Build final` atualizou os 2 itens.
- Revisão pós-implementação corrigiu:
  - navegação por tag usava `replaceState` e quebrava Voltar/Avançar → agora usa navegação shallow + sincronização no `popstate`;
  - filtro combinado vivia só no componente → extraído para `src/lib/library-filter.ts` com testes de tag × tipo × busca.
- Detalhes em [`docs/tags.md`](docs/tags.md).

## 23. Fase 3 — correções da revisão de código (v0.18.0)

Executada em 11/11/2026 sobre `v0.17.0` (`PLANO-CORRECOES.md`, 19 FIXes).

- **Integridade e ordem**
  - FIX-01: `updateSource`/`updateGroup` sincronizam `savedFilters` (categoria+fonte) e descartam `groupId` de outra categoria; mover fonte com filtro salvo não retorna mais 400.
  - FIX-02: `updateItem` recalcula `order` ao mudar categoria/grupo (mesmo resultado do drag & drop).
  - FIX-10: `recoverHubState` mantém entradas válidas de `estado.json`, descarta só o inválido e o layout mostra o que foi recuperado.
  - FIX-03: `restoreBackup` cria o ponto de segurança dentro do lock e faz rollback de hub/estado/cache se uma gravação falhar.
- **Feed**
  - FIX-04: HTML/XML inválido é erro (`FeedFormatError`), mantém posts antigos e não limpa o erro da fonte.
  - FIX-05: refresh forçado é enfileirado em vez de reaproveitar a execução em andamento.
  - FIX-06: Atom prefere `rel="alternate"` e lê `dc:date`.
  - FIX-07: thumbnail só aceita mídia de imagem.
  - FIX-08: `redditPostInfo` protege `decodeURIComponent` (400, não 500).
- **Resiliência e segurança**
  - FIX-09: `browser-storage` protege `localStorage` na home e no feed.
  - FIX-13: salvos sem snapshot aparecem como “Conteúdo indisponível” com botão de remover.
  - FIX-11: DNS resolvido uma vez e IP fixado na conexão (`node:http/https`), IPv6 mapeado/NAT64/6to4 cobertos.
  - FIX-17: service worker migrado para `src/service-worker.ts` com `version` do build, poda de caches antigos e limite de 120 entradas.
  - FIX-12: fallback offline sempre responde (HTML embutido) e navegação tem timeout de 8 s.
- **Menores**
  - FIX-14: índice da busca memoizado por identidade de hub/feed.
  - FIX-15: OPML só exporta URLs http(s).
  - FIX-16: ordem das fontes normalizada por categoria e listas planas agrupadas por categoria.
  - FIX-18: `.env` inválido gera log; VBS procura Node em Program Files (x86)/LocalAppData/PATH; instalador valida Node 24+.
  - FIX-19: payloads de `/api/hub`, `/api/state` e `/api/backup/restore` validados; erros internos não vazam mensagem.
- `npm run verify` verde com **553 testes** em 76 arquivos.
- Observação: `package.json` continua em `0.0.1`; a versão do produto é a tag (`v0.18.0`).

## 24. Fase 1 — fechamento (v0.19.0)

Executada em 11/11/2026 sobre `v0.18.0`, fechando os itens pendentes da Fase 1 do `PLANO-EXECUCAO.md`.

- **DATA-07 — migrações versionadas**: `src/lib/migrations/` com cadeia pura (`migrateHub` v1→v2). O v2 normaliza `order` das fontes por categoria. No load, o `JsonFileStorage` migra, valida, guarda `hub.json.pre-vN.bak` e grava o resultado; carregar arquivo já migrado não escreve. Versão futura é recusada com mensagem clara e sem tocar no arquivo. `estado.json`/`feed-cache.json` passam pelo mesmo framework (passthrough + guarda de versão).
- **DATA-03 — refresh concorrente com progresso**: `mapWithConcurrency` (limite 4, ordem preservada) e `durationMs` por fonte. `POST /api/refresh` com `async: true` devolve `202 { jobId, total }`; `GET /api/refresh/status?id=` devolve o progresso; home, feed e Gerenciar mostram “Atualizando 3/10...”. O caminho síncrono continua igual para fonte única.
- **PLAT-03a — fontes locais**: Inter e Space Grotesk variáveis em `static/fonts` (`@font-face` em `app.css`), sem `fonts.googleapis.com`/`gstatic.com`; imagens externas com `referrerpolicy="no-referrer"`.
- **SEC-02 — CSP enforced**: `withSecurityHeaders` aplica `Content-Security-Policy` (não Report-Only) em HTML e API (assets estáticos saem antes do hook do adapter-node; limitação no README); política sem origens do Google, com `frame-ancestors 'none'` e players permitidos. README ganhou a seção “Segurança e privacidade”.
- `npm run verify` verde com **600 testes** em 85 arquivos.

## 25. Fase 2 — produtividade (v0.20.0)

Executada em 11/11/2026 sobre `v0.19.0`.

- **ORG-18 — notas no hub**: `data/notes.json` (`{ version, notes[] }`) com Zod, escrita atômica, `.bak` e lock; API `/api/notes` (`save`/`delete`) e `GET`; a Nota rápida da home salva com debounce de 500 ms e mostra “Salvo no hub”; notas entram no export/import (replace e merge por id).
- **ORG-12 — testar fonte**: `POST /api/test-source` busca com `safe-fetch`, faz parse, aplica include/exclude e devolve total, quantos passam nas regras e os 3 primeiros títulos; botão **Testar** no editor de fonte, sem gravar no cache.
- **ORG-17 — Acesso rápido**: `settings.quickAccessOrder` e `quickAccessLimit` (3–12); a home respeita a ordem manual, permite arrastar e reordenar (com botões ↑/↓ para teclado), desafixar no modo de edição e fixar/desafixar direto nos cards da Biblioteca.
- **ORG-06 — palette de comandos**: índice único com links, apps, categorias, fontes, posts, notas e comandos; operadores `>`, `tag:`, `source:`, `is:unread`, `is:saved`; comandos “Adicionar link/fonte/categoria”, “Abrir Gerenciar”, “Biblioteca”, “Feed”, “Salvos”, “Exportar” e “Atualizar feed” (executa o job com progresso).
- `npm run verify` verde com **657 testes** em 92 arquivos.

## 26. Fase 4 — CI, E2E e acessibilidade (v0.21.0)

Executada em 11/11/2026 sobre `v0.20.0`.

- **CI**: `.github/workflows/ci.yml` roda em push/PR para `master`: `npm ci`, `check`, `lint`, `test`, `build`; em seguida o job `e2e` instala Chromium, builda e roda Playwright, com relatório como artefato em falha.
- **Playwright**: `playwright.config.ts` sobe o build em `127.0.0.1:5760` com `HUB_DATA_DIR=.e2e-data` (recriado no global setup a partir de `data/hub.example.json`). `bypassCSP` apenas no teste, para o axe injetar o script.
- **Cobertura**: 7 fluxos de produto (adicionar link; salvar post em Salvos; marcar tudo como lido com desfazer; nota rápida; palette busca e comando; mobile 375 px sem overflow) + axe sem violações **críticas ou sérias** em `/`, `/feed`, `/biblioteca` e `/gerenciar`. Total de 11 testes, estáveis em execuções repetidas. A suíte é hermética: o fixture desliga as fontes e `e2e/fixtures.ts` bloqueia qualquer requisição fora de 127.0.0.1.
- Scripts novos: `npm run test:e2e`, `npm run test:e2e:report` e `npm run check:e2e` (type-check de `e2e/` + config, incluído no `verify`).
- Faltam no E2E: importar bookmarks/OPML e testar fonte pelo Gerenciar (cobertos por testes de rota, não por fluxo de navegador).
- `npm run verify` segue verde (657 testes em 92 arquivos) e `npx playwright test` passa 8/8 localmente.
- **CI validado no GitHub**: run [43132331993](https://github.com/josemelao/ihub/actions/runs/43132331993) — jobs `check · lint · test · build` e `e2e · axe` verdes.

## 27. Fase 4 — mobile e preferências (v0.23.0)

Executada em 12/11/2026 sobre `v0.22.0`.

- **Navegação mobile**: abaixo de 900 px a sidebar vira drawer (botão ☰ no topbar, backdrop, Esc e fechamento automático após navegar). A primeira tela deixa de ser consumida pelo menu.
- **Preferências**: `settings.density` (confortável/compacta), `fontSize` (13/14/15) e `highContrast` aplicados como atributos no `html` e salvos via `update-settings`; controles em **Gerenciar → Aparência**.
- **CSS**: drawer, overlays e tokens de contraste; densidade compacta reduz paddings/gaps; `body` acompanha o tamanho escolhido (micro-badges decorativos continuam em 10–11 px).
- **Testes**: unitário de `updateSettings`; E2E cobre overflow em 375 px, abrir/navegar/fechar o drawer, persistência das preferências após reload e axe com contraste alto. Suíte E2E agora com 14 testes.

## 28. Fase 4 — título, notificação e tokens (v0.24.0)

Executada em 12/11/2026 sobre `v0.23.0`.

- **PLAT-07**: título da aba com contagem de não lidos (`formatUnreadTitle`), badge desenhado no favicon e notificação **opt-in** (`settings.notifyUnread`), exibida só com a aba oculta, permissão concedida e quando a contagem **aumenta**. A decisão fica em `shouldNotify` com testes. O título passa a ser `(N) Meu Hub` e substitui o título específico da rota.
- **PLAT-10**: tokens novos em `:root` (`--panel-hover`, `--line-strong`, `--ok*`, `--danger*`) substituindo as cores fixas; `fs-15`/`fs-16` para os títulos que usavam estilo inline. Único `font-size` inline restante é o ícone dimensionado por prop.
- **Testes**: unitários de título/notificação e um teste que impede voltar a hardcodar cores ou tipografia inline; E2E novo valida o título com e sem não lidos (15 testes E2E).

## 29. Fase 4 — token opcional e diagnóstico (v0.25.0)

Executada em 12/11/2026 sobre `v0.24.0`.

- **Token opcional**: com `HUB_API_TOKEN` definido, POST/DELETE em `/api/*` exigem `Authorization: Bearer <token>` (comparação em tempo constante). GETs e páginas continuam livres; sem a variável nada muda.
- **`/api/health`**: versão, uptime, diretório de dados, permissão de escrita, contagens (categorias, itens, fontes, salvos, notas, posts), `feedUpdatedAt` e lista de erros de leitura. Nunca devolve token nem conteúdo.
- **Diagnóstico** em Gerenciar → Aparência: botão “Verificar saúde” mostra os mesmos dados.
- **Testes**: 3 unitários do token (constante, formato, ausência) + 4 de rota/hook (`/api/health`, 401 sem Bearer, GET livre, sem token passa).

## 30. Fase 2 — primeiro uso (v0.26.0)

Executada em 12/11/2026 sobre `v0.25.0`.

- **Detecção**: `hasHub()` no storage; o layout recebe `hubMissing` e `dataDir`.
- **`POST /api/setup`**: `{ mode: "example" | "empty" }` cria o `hub.json` **apenas** quando ele não existe (409 caso contrário); exemplo vem de `data/hub.example.json`, já validado e migrado.
- **UI**: painel de primeiro uso na home com “Começar com exemplo” e “Começar vazio”, explicando onde os dados ficam.
- **Testes**: 4 de rota (exemplo, vazio, 409, mode inválido). Restante do fluxo (importar favoritos) continua no Gerenciar.

## 31. Fase 4 — modelo de erro de storage (v0.27.0)

Executada em 12/11/2026 sobre `v0.26.0`.

- **`StorageError`** (`src/lib/storage/errors.ts`) com `code` (`NOT_FOUND`, `INVALID_JSON`, `IO`, `LOCK_TIMEOUT`, `VALIDATION`), `path` e `cause`. `HubValidationError` continua só para schema.
- **Leitura**: arquivo ausente e JSON inválido deixam de ser “validação” e passam a `StorageError`; fallback de hub/estado/cache/notas e a recuperação de estado reconhecem os dois tipos.
- **Rotas**: backup inexistente responde **404**; `/api/state` mantém fallback para backup; `/api/hub` e `/api/export` devolvem JSON 500 com `code` em erro de storage.
- **Compatibilidade**: nomes de arquivo mantidos (`estado.json`, não `state.json`) — renomear exigiria migração de backups sem ganho funcional. Arquivos antigos continuam válidos.
- **Testes**: 5 do `StorageError` + ajustes das expectativas de storage e rota (688 testes verdes).

## 32. Leva pequena — Reddit 429 e fechamentos (v0.28.0)

Executada em 12/11/2026 sobre `v0.27.0`.

- **Reddit 429 corrigido**: o app montava `/r/<sub>/new.rss`, alias bloqueado para acesso não autenticado. Agora usa `/r/<sub>/.rss` e reescreve URLs legadas salvas (`/new.rss` e `/new/.rss`). O User-Agent virou `Mozilla/5.0 (compatible; MeuHub/0.1; +https://github.com/josemelao/ihub)`, aceito pelo Reddit; o UA antigo era bloqueado mesmo no endpoint correto.
- **Erro 429 legível**: mensagem “O site limitou temporariamente as requisições (429). Tente de novo em alguns minutos.”
- **SEC-02**: decisão registrada — headers de segurança cobrem HTML/API; assets estáticos são servidos pelo adapter-node antes do `hooks.server`. A limitação fica documentada no README (sem wrapper de servidor).
- **PLAT-02 e 2 fluxos E2E**: validação de logon e os fluxos de importar bookmarks/testar fonte seguem **manuais** (checklist abaixo); nada de código pendente.
- `npm run verify` e `npx playwright test` verdes.
- Checklists do plano (seção 9) atualizados com o que foi verificado; validação manual restante em [`docs/validacao-v0.28.md`](docs/validacao-v0.28.md).

## 33. Validação e fechamento da v0.28.0 (12/11/2026)

Executada sobre `v0.28.0` (`125e32e`), fechando o gate de release.

- **Automatizado em ambiente isolado**: servidores temporários com `HUB_DATA_DIR` em pasta temp (portas 5761–5764), sem tocar nos dados reais.
  - Primeiro uso: painel aparece sem `hub.json`; `POST /api/setup` `example` → 200 (5 categorias/31 itens), `empty` → 200 (0/0/0), repetido → 409.
  - Token opcional: POST sem Bearer → 401; Bearer correto → 200; Bearer errado → 401; GET `/api/health` livre.
  - Backup: criar → 200, listar → 1 ponto, download → 200, restaurar → 200 com ponto de segurança.
  - Export → import `replace`: 5 categorias, 31 itens e a nota rápida preservados.
  - `/api/health`: `writable: true`, `errors: []`, sem segredo no JSON; `data/notes.json` ignorado pelo Git.
- **Manual (dono)**: feed com r/Darktide, mobile 375 px (drawer, preferências, título/badge), desktop 1440, teclado, accent claro/escuro e autostart completo (instalar, logoff/logon, fechar terminal, desinstalar).
- **Diagnóstico “Reddit atualizado mas vazio”**: o refresh estava correto (`count: 25`, `error: null`), mas a fonte tinha `include: ["patch"]` e nenhum post casava — a view descartava todos. Filtro removido; os cards voltaram a renderizar. Não era regressão da v0.28.
- **Flakiness corrigida**: `src/lib/autostart.test.ts` (timeout 20 s → 60 s) — PowerShell + COM levam ~10 s isolados e ~22 s com a suíte em paralelo. Duas execuções completas verdes depois.
- **Qualidade**: `npm run verify` verde, 691 testes em 99 arquivos, 15/15 E2E (Chromium 1254 reinstalado via `npx playwright install chromium`), `npm audit --omit=dev` limpo.
- **Backup**: `data/backups/validacao-v0.28-20261112-112508` (ignorado pelo Git).
- **Commits**: `4cd46e8` (test), `5aaa300` (docs) e o commit de fechamento deste handoff.
- **Próximo bloco**: Fase 3 — READ-01 (reader mode + texto completo) e READ-02 (highlights, notas e cores por salvo).
  - Implementado na v0.29.0 (seção 34).

## 34. Fase 3 — reader mode e destaques (v0.29.0)

Executada em 12/11/2026 sobre `v0.28.0`, implementando READ-01 e READ-02.

- **Extração e sanitização**: `@mozilla/readability` sobre `linkedom`, `sanitize-html` com allowlist (links absolutos `http(s)`, `rel="noopener noreferrer"`, imagens com `referrerpolicy="no-referrer"`; `script`/`on*`/`style` removidos). HTML sanitizado ≤ 2 MB; texto ≤ 200k chars (truncado, com `length` original).
- **Storage**: `data/reading/<itemId>.json` por artigo (fora do layout; poda em 300 por `fetchedAt`) e `data/highlights.json` (leve, carregado no layout). Ambos versionados, ignorados pelo Git e com escrita atômica; `highlights.json` tem `.bak` e entra no export/import. **Desvio do design**: em vez de um `reading.json` único, os artigos ficam em arquivos separados porque 100–500 KB de HTML por artigo fariam cada leitura carregar o acervo inteiro.
- **Toggle por fonte**: `feedSources[].fullText` (padrão `false`), editável em Gerenciar → Fontes. O toggle controla novas extrações; artigo já cacheado continua legível. “Ativar texto completo” grava o toggle e extrai na hora.
- **Reader** em `/ler/[id]`: SSR entrega o artigo cacheado (offline); sem cache, o cliente chama `POST /api/reader`. Fallback com “Abrir original”; YouTube/Reddit não têm reader. Resolução do post: feed → snapshot salvo → artigo → 404.
- **Destaques**: seleção de texto abre a toolbar com quatro cores (rótulo textual, não só cor) e “Anotar”. Lista no fim do artigo e em `/highlights`, com busca e link para o original. `POST /api/highlights` cobre save/update/delete; destaque não exige salvar o post. v1 não renderiza inline; `occurrence` fica guardado para permitir isso depois.
- **APIs novas**: `POST /api/reader`, `POST /api/highlights`.
- **Qualidade**: 736 testes em 110 arquivos; 21 E2E (reader, persistência de destaque, offline sem requisição externa, fonte sem full text, `/highlights` e axe em `/ler/e2e-post` e `/highlights`); `npm run verify` verde.
- **Adiado**: export Markdown dos destaques (READ-04), arquivo/offline do item salvo (READ-03), busca full-text (READ-05), renderização inline dos destaques. Backups manuais continuam cobrindo só hub/estado/cache (mesma limitação de `notes.json`).
- **Docs**: `docs/leitura-highlights.md` (design) e plano em `C:\Users\Usuario\.opencode\plan\leitura-highlights.md`.

## 35. Fase 3 — arquivo/offline do item salvo (v0.30.0)

Executada em 12/11/2026 sobre `v0.29.0`, implementando READ-03.

- **Arquivamento automático:** ao salvar (single ou `save-many`), o `/api/state` dispara um job em segundo plano; salvar nunca espera o download. Status `pending` → `ready`/`failed` em `data/archive.json`. Dessalvar apaga o arquivo; import/restauração não apagam (órfãos aparecem em Gerenciar como “não salvo”).
- **Página inteira local:** busca com `safe-fetch` (5 MB/10 s), sanitiza o `<body>` completo (allowlist ampliada, sem script/iframe/style/on*), baixa até 20 imagens (2 MB cada, 20 MB total) para `data/archive/<id>/assets/` e grava `index.html` + `assets.json`. SVG e `data:` ficam de fora; `data-src` é promovido; `srcset` é descartado.
- **Servição:** `/arquivo/[id]` entrega o documento como página de topo, com CSP restrita (`script-src 'none'`, `img-src 'self'`, CSS local). Assets em `/api/archive/[id]/assets/[name]` com content-type guardado e validação de path.
- **UI:** reader mostra status/tamanho, “Abrir versão arquivada”, “Arquivar agora”, “Tentar de novo” e “Remover arquivo” (com confirmação); Gerenciar → Backups → “Leitura arquivada” mostra total, lista, retry e apagar. Polling de 2 s enquanto houver `pending`.
- **Limites:** 3 MB de HTML sanitizado, 200 arquivos (`ready`+`pending`) e 500 MB; ao atingir, o job falha com mensagem para remover em Gerenciar. Nada é apagado sozinho.
- **Testes:** 780 unitários em 112 arquivos e 28 E2E (arquivo sem rede externa, link no reader, Gerenciar, axe em `/arquivo/e2e-post`); `npm run verify` e Playwright verdes.
- **Adiado:** export/backup dos arquivos (ficam locais), mídia pesada (vídeo/áudio), SVG e retry automático em loop.
- **Docs:** `docs/archive.md` e plano em `C:\Users\Usuario\.opencode\plan\archive-reader.md`.

## 36. Fase 3 — export Markdown (v0.31.0)

Executada em 12/11/2026 sobre `v0.30.0`, implementando READ-04 e fechando o aceite adiado do READ-02.

- **API:** `GET /api/export/markdown` monta em memória um ZIP (`fflate`, ~8 KB) com `index.md` + um `.md` por item salvo ou destacado. `content-disposition` com `meu-hub-export-AAAA-MM-DD.zip`; nenhum arquivo temporário no disco.
- **Builder puro:** `src/lib/export/markdown.ts` com frontmatter YAML (título, URL, fonte, categoria, datas, `saved`, `archived`, tags), resumo, links para `/ler/<id>`, original e `/arquivo/<id>` (quando arquivado), e destaques com cor/nota. Links usam `event.url.origin`; nomes `<slug>-<id>.md` (id completo) evitam colisão.
- **Metadados:** snapshot manda; feed/hub preenchem o que faltar. Item só com destaque entra com `saved: false`; salvo sem snapshot vira stub ou resolve pelo feed, sem sumir.
- **YAML:** strings com aspas escapadas e quebras normalizadas; tags normalizadas (categoria/fonte), sem cores.
- **UI:** Gerenciar → Backups → **Exportar salvos em Markdown** (download direto).
- **Testes:** 791 unitários em 114 arquivos (builder com 6 casos + rota descompactando o ZIP) e 29 E2E (download real no Gerenciar, conferindo frontmatter e destaque); `npm run verify` e Playwright verdes.
- **Adiado:** conversão do HTML arquivado para Markdown, imagens no ZIP e exportar itens da Biblioteca.
- **Docs:** `docs/markdown-export.md`; plano em `C:\Users\Usuario\.opencode\plan\markdown-export.md` (ledger em `.superpowers/sdd/markdown-export`).
