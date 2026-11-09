# Handoff — Meu Hub

Data: 2026-11-09
Estado: **M0–M5 concluídos + iteração final de layout do feed**. Projeto local, funcional e com testes verdes.

## 1. O que é

Hub pessoal local que roda no navegador como página inicial:

- Links e apps do PC organizados em categorias/grupos.
- Feed de RSS/Atom, Reddit e YouTube com filtro por palavra-chave.
- Busca rápida (Ctrl K), leitura/salvamento de posts e visualizações Bento/Compacto/Grade.
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
    feed/ favoritos/ apps/ gerenciar/
    api/                       # hub, feed, refresh, state, export, import, discover-feed
data/
  hub.example.json             # seed versionado
  hub.json                     # dados reais (ignorado pelo Git)
  estado.json                  # lidos/salvos (ignorado)
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

- Sidebar fixa com categorias e contadores, responsiva.
- Início: busca Ctrl K, acesso rápido, feed, fontes e nota rápida.
- Category: grupos, links/apps e feed da categoria.
- Feed, Favoritos, Apps do PC e Gerenciar.
- **Feed completo**: cabeçalho com total no cache, fontes ativas e última atualização; lista de fontes com estado ativa/desligada.
- **Favoritos**: atalhos fixados, filtros salvos e posts salvos; estado vazio contextual (“Nenhum post salvo ainda”).
- **Apps do PC**: grade de apps por categoria, mostrando o protocolo e ação de abrir.

### Acesso rápido

- É **manual**: itens com `pinned: true`.
- Definido em Gerenciar → Links/Apps → Editar → “Fixar no acesso rápido da home”.
- Não há rastreamento de uso.

### Busca Ctrl K

- Paleta com Fuse.js sobre itens e categorias.
- Ignora acento, tolera erro de digitação, navega com setas, Enter abre, Esc fecha.
- Links abrem em nova aba; apps disparam o protocolo.

### Feed

- Fontes: RSS/Atom (URL), Reddit (subreddit ou `.rss`), YouTube (ID `UC...` ou URL de feed).
- Refresh: timeout 10 s, User-Agent, limite de 5 MB, 30 posts/fonte, retenção 30 dias, dedupe por URL/guid.
- Scheduler a cada ~60 s (só fontes vencidas) + “Atualizar agora”.
- Falha de uma fonte não afeta as outras; status e erro aparecem em Gerenciar/Feed.
- Regras por fonte (`include`/`exclude`/`matchMode`) aplicadas sobre título+resumo, sem acento/caixa.
  - Filtro ao vivo: palavra-chave, qualquer/todas, filtros salvos com contagem, chips de categoria, “Não lidos”, destaque do termo.
  - **+ Salvar filtro** captura a busca atual (e o modo) num diálogo, pede um nome e grava no `hub.json`.
  - Ações: abrir, salvar para depois, marcar como lido; “marcar tudo como lido” respeita o filtro.
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
- **Compacto**: lista, texto primeiro, sem placeholder; imagem opcional em miniatura.
- **Grade**: 2 colunas, imagens 16:9, altura natural (cards curtos não esticam).
- A escolha fica em `localStorage` (`meu-hub:feed-view`).
- Painel direito da home é recolhível (`meu-hub:panel-open`), com largura/opacidade animadas.
- **Animações**: cards saem com fade, os restantes deslizam para a nova posição (CSS `left/top/width` no Bento e FLIP no Compacto/Grade); painel desliza ao recolher. Respeita `prefers-reduced-motion`.

> Histórico: tentamos Bento com larguras mistas (1/3, 1/2, 2/3). Foi abandonado porque masonry com spans variados abre buracos e os spans mudavam ao filtrar/marcar como lido. Colunas iguais resolveram.

### Gerenciar / edição

- Abas funcionais: Fontes, Links, Apps, Categorias, Regras.
- Painel lateral com `<dialog>` nativo (foco, Esc, backdrop).
- Adicionar/editar/remover:
  - Links e apps (com checkbox de acesso rápido).
  - Fontes (tipo, alvo, categoria, grupo, intervalo, include/exclude, liga/desliga).
  - Categorias (nome/cor, remover se não estiver em uso).
  - Filtros salvos (adicionar/remover).
- Reordenar itens e categorias com ↑/↓.
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

- Não há UI para **criar/editar grupos**; categoria com grupos não pode ser removida (a mensagem orienta mover, mas não há ferramenta).
- **Concorrência**: duas escritas simultâneas usam “última vence”; não há fila/otimistic lock.
- **Importação**: `bundle.state` não é validado antes de gravar o hub; um estado malformado pode deixar import parcial.
- **Proxy de rede**: o `fetch` do Node não lê `HTTPS_PROXY` automaticamente; redes com proxy podem falhar no feed.
- YouTube exige ID do canal (`UC...`) ou URL de feed; `@handle` não é resolvido.
- Filtros salvos não podem ser editados, só removidos.
- Fontes de feed não têm reordenação (modelo não tem `order`).
- `npm audit` completo tem avisos em dependências de desenvolvimento (ESLint).
- O feed é sempre por data; não há ordenação alternativa.

## 11. Próximos passos sugeridos

1. Gerenciamento de grupos (criar/editar/mover) para liberar remoção de categorias.
2. Fila de escrita/otimistic lock no storage.
3. Validar `bundle.state` antes de importar.
4. Suporte a proxy (`HTTPS_PROXY`) no refresh/discover.
5. Revisão de acessibilidade do masonry (ordem visual x DOM já é preservada).
6. Testes de componente/e2e para as visualizações.
7. Edição de filtros salvos (hoje só criar/remover).

## 12. Notas para o próximo agente

- Rode `npm test` antes e depois de qualquer mudança.
- Faça commits pequenos por fase.
- Não reintroduza `inert` no `.app-shell`; o modal é um `<dialog>` nativo.
- O Bento usa posicionamento absoluto via `use:masonry`; se mudar o DOM, garanta que os cards sejam filhos diretos de `.feed-layout`.
- Ao mexer no parser, rode os testes de `parse.test.ts` (entidades, imagens, YouTube, Reddit).
- Dados pessoais: nunca comite `data/hub.json`, `estado.json` ou `feed-cache.json`.
