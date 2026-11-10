# Handoff — Meu Hub

Data: 2026-11-09
Estado: **M0–M5 concluídos + iteração final de layout do feed**. Projeto local, funcional e com testes verdes.

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
npm test        # 113 testes
npm run check   # svelte-check
npm run lint    # Prettier + ESLint
npm run build
npm audit --omit=dev
```

Estado no handoff: **113/113 testes, 0 erros/avisos no check, lint limpo, build ok, 0 vulnerabilidades de produção**.
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
