# Plano de correções — revisão de código (pós v0.17.0)

> **Status:** executado em 11/11/2026 (todos os 19 FIXes, um commit por item).
> **Base:** `master` em `5dd5ffa` (`v0.17.0`), 440 testes em 58 arquivos; ao fim, 544 testes em 76 arquivos.
> **Origem:** revisão de código feita em 11/11/2026.
> **Regra:** este documento é só o plano. Cada tarefa só começa quando o dono autorizar.

## Objetivo

Corrigir falhas e escapes encontrados nas partes já implementadas, priorizando integridade dos dados, ordem manual, feed e resiliência. Não inclui itens que já estão no backlog de produto (refresh concorrente com progresso, migrações versionadas, CSP enforce, reader, highlights, etc.).

## Estratégia

- Uma correção por commit, com teste de regressão antes da implementação.
- Funções puras primeiro; UI depois.
- Nada de dependência nova, exceto se uma tarefa exigir e isso for aprovado antes.
- `npm run verify` verde ao fim de cada grupo.
- Branch por grupo: `fix/integridade-dados`, `fix/feed`, `fix/resiliencia`, `fix/menores`.

## Prioridades

| Grupo                   | Tarefas                | Prioridade | Risco se ficar como está                                 |
| ----------------------- | ---------------------- | ---------- | -------------------------------------------------------- |
| Integridade e ordem     | FIX-01, FIX-02, FIX-03 | P0         | Edição bloqueada, ordem errada, restauração parcial      |
| Feed                    | FIX-04 a FIX-08        | P1         | Fonte quebrada parece saudável, parser perde links/datas |
| Resiliência e segurança | FIX-09 a FIX-13        | P1/P2      | App quebra sem storage, estado perdido, SSRF residual    |
| Menores                 | FIX-14 a FIX-19        | P2         | Performance, export inválido, mensagens ruins            |

---

## Fase 1 — Integridade dos dados e ordem manual

### FIX-01 — Filtros salvos consistentes ao mover fonte/grupo de categoria

**Problema:** `updateSource` e `updateGroup` mudam `source.categoryId`, mas não atualizam `savedFilters` que apontam para a fonte. O schema rejeita a inconsistência e a edição falha com “Referência inconsistente”.

**Arquivos:**

- `src/lib/hub-edit.ts`
- `src/lib/hub-edit.test.ts` (ou novo `hub-edit-filter-scope.test.ts`)
- `src/lib/schema.test.ts` se necessário

**Mudança:**

- Criar helper puro `syncFilterScopeForSource(hub, sourceId, categoryId)`:
  - para cada filtro com `sourceId === sourceId` e `categoryId` definido, trocar `categoryId` para a nova categoria;
  - filtros só com `sourceId` permanecem iguais;
  - filtros sem relação não mudam.
- Aplicar em `updateSource` quando `categoryId` mudar.
- Aplicar em `updateGroup` para cada fonte movida.
- Garantir que `parseHub(resultado)` não lance.

**Testes:**

- Filtro categoria+fonte acompanha a fonte ao mudar de categoria.
- Filtro só de fonte não ganha categoria.
- Mover grupo com fonte atualiza o filtro.
- `parseHub` continua válido.

**Aceite:**

- [ ] Editar categoria de fonte com filtro salvo não retorna 400.
- [ ] Mover grupo com fonte e filtro não retorna 400.
- [ ] Nenhum filtro sem relação é alterado.

**Commit:** `fix(edit): keep saved filter scope in sync with moved sources`

---

### FIX-02 — Ordem de itens ao mudar categoria/grupo

**Problema:** `updateItem` muda `categoryId`/`groupId` e mantém `order`; `updateGroup` move itens para outra categoria sem recalcular a ordem. O item pode ficar no meio/fim errado e ordens duplicadas aparecem.

**Arquivos:**

- `src/lib/hub-edit.ts`
- `src/lib/hub-edit.test.ts`
- `src/lib/hub-actions-order.test.ts` se aplicável

**Mudança:**

- Criar helper `nextItemOrderExcluding(hub, categoryId, groupId, excludeId)` ou reutilizar `nextItemOrder` com filtro.
- Em `updateItem`, se `categoryId` ou `groupId` mudar:
  - definir `order = próximo do destino`;
  - remover `groupId` quando `null`.
- Em `updateGroup` com `categoryChanged`, reatribuir ordem dos itens movidos para o fim do destino, sequencialmente.
- Normalizar ordens duplicadas do grupo destino se necessário.

**Testes:**

- Item movido pelo editor para grupo com ordens 1–2 recebe 3.
- Item movido para grupo vazio recebe 1.
- Item movido junto com grupo para outra categoria recebe ordem no fim.
- Não há ordens duplicadas no grupo destino.
- `parseHub` válido.

**Aceite:**

- [ ] Mover pelo editor tem o mesmo resultado de ordem do drag & drop.
- [ ] Mover grupo não embaralha a ordem dos itens.
- [ ] Nenhum item fica com `order` antigo no grupo novo.

**Commit:** `fix(edit): recalculate item order when moving category or group`

---

### FIX-03 — Restauração de backup atômica e com rollback

**Problema:** `restoreBackup` cria o ponto de segurança fora do lock e grava hub/estado/cache em sequência; falha no meio deixa dados misturados.

**Arquivos:**

- `src/lib/storage/json-file.ts`
- `src/lib/storage/json-file.test.ts`

**Mudança:**

- Extrair a criação de backup manual para `createBackupUnlocked()`.
- `backupNow` chama `createBackupUnlocked` sob os locks atuais.
- `restoreBackup`:
  - valida backup antes;
  - adquire os três locks;
  - lê e valida o estado atual (hub/estado/cache) para rollback;
  - cria o ponto de segurança **dentro** do lock, sem reentrar em `backupNow`;
  - grava hub, estado e cache;
  - se qualquer gravação falhar, restaura os valores anteriores e relança o erro.
- Manter o ponto de segurança mesmo se a restauração falhar (é útil para diagnóstico).

**Testes:**

- Falha simulada ao gravar estado restaura o hub anterior.
- Falha simulada ao gravar cache restaura hub/estado anteriores.
- Caminho feliz continua criando ponto de segurança.
- Nenhum lock fica preso após erro.

**Aceite:**

- [ ] Restauração com falha não deixa hub/estado/cache misturados.
- [ ] O ponto de segurança é criado antes da sobrescrita.
- [ ] Teste de concorrência não regride.

**Commit:** `fix(storage): make backup restore atomic with rollback`

---

## Fase 2 — Feed

### FIX-04 — Feed HTML/malformado não pode ser reportado como sucesso

**Problema:** `fetchPublicText` aceita `text/html`; `parseFeed` devolve `[]`; `refreshFeed` mantém posts antigos, limpa o erro e atualiza `lastFetchedAt`. O usuário vê “Feed atualizado” com a fonte quebrada.

**Arquivos:**

- `src/lib/feed/parse.ts`
- `src/lib/feed/refresh.ts`
- `src/lib/feed/refresh.test.ts`
- `src/lib/feed/parse.test.ts`

**Mudança:**

- `parseFeed` passa a distinguir:
  - feed válido vazio (sucesso, 0 itens);
  - XML inválido/HTML/sem `<rss|feed|rdf:RDF>` (erro de formato).
- Criar `FeedFormatError` ou retorno `{ items, formatError }`; manter uma função compatível se necessário.
- `refreshFeed`:
  - em erro de formato, manter itens anteriores, gravar `error` na fonte e **não** limpar o erro;
  - só `ok: true` quando o documento for um feed reconhecido;
  - decidir se `lastFetchedAt` avança em erro (recomendado: avançar, mas manter `error`).
- Considerar exigir content-type XML no refresh; HTML só é aceito no discover/link-metadata.

**Testes:**

- URL retornando HTML → resultado `ok: false`, status com erro, posts antigos preservados.
- XML malformado → erro.
- Feed válido vazio → `ok: true`, 0 itens.
- Feed válido normal continua funcionando.

**Aceite:**

- [ ] Fonte apontando para uma página HTML mostra erro.
- [ ] Posts antigos não somem no erro.
- [ ] “Atualizar agora” mostra falha por fonte.

**Commit:** `fix(feed): treat non-feed content as an error`

---

### FIX-05 — `force` não pode ser engolido pelo refresh em andamento

**Problema:** `createRefreshRunner.run` retorna a promise existente mesmo quando o novo pedido é `force: true`; “Atualizar agora” pode não forçar nada se o scheduler estiver rodando.

**Arquivos:**

- `src/lib/feed/refresh-runner.ts`
- `src/lib/feed/refresh-runner.test.ts`

**Mudança:**

- Se a chave já está em execução:
  - pedido não-forçado igual: retorna a promise existente;
  - pedido forçado: enfileira uma nova execução forçada para depois da atual e retorna essa promise;
  - pedido forçado com execução forçada em andamento: coalesce.
- Registrar no ledger/teste que refresh global e por fonte podem rodar em paralelo; avaliar serialização por cache se necessário.

**Testes:**

- Duas chamadas não-forçadas simultâneas → uma execução.
- Forçada durante não-forçada → duas execuções, a segunda forçada.
- Duas forçadas simultâneas → uma execução.
- Fonte específica não bloqueia global.

**Aceite:**

- [ ] Clicar em “Atualizar agora” durante o scheduler executa um refresh forçado.
- [ ] Nenhum fetch duplicado desnecessário.

**Commit:** `fix(feed): queue forced refresh instead of reusing in-flight run`

---

### FIX-06 — Atom: escolher `rel="alternate"` e ler `dc:date`

**Problema:** `linkOf` pega o primeiro `href` do Atom, inclusive `rel="self"`; datas em `dc:date` são ignoradas.

**Arquivos:**

- `src/lib/feed/parse.ts`
- `src/lib/feed/parse.test.ts`

**Mudança:**

- `linkOf`/novo `atomLinkOf`:
  - preferir `rel` ausente ou `alternate`;
  - ignorar `self`, `enclosure`, `edit`;
  - validar `http(s)`;
  - fallback para o primeiro link seguro.
- `publishedAtOf` incluir `item['dc:date']` e `item.date`.
- Manter compatibilidade com RSS.

**Testes:**

- Atom com `self` antes de `alternate` usa o alternate.
- Atom só com `self` cai no fallback ou é descartado de forma segura.
- `dc:date` é lido.
- Datas inválidas continuam `''`.

**Aceite:**

- [ ] Item Atom aponta para o artigo, não para o feed.
- [ ] Posts com `dc:date` são ordenados/podados corretamente.

**Commit:** `fix(feed): prefer Atom alternate links and parse dc:date`

---

### FIX-07 — Thumbnail só de mídia de imagem

**Problema:** o parser usa o primeiro `enclosure`/`media:content` como thumbnail, mesmo quando é áudio/vídeo. O card tenta renderizar MP3/MP4 como imagem.

**Arquivos:**

- `src/lib/feed/parse.ts`
- `src/lib/feed/parse.test.ts`

**Mudança:**

- Verificar `type` antes de aceitar:
  - `image/*` sempre;
  - `media:thumbnail` sempre;
  - URL com extensão de imagem como fallback quando não houver type;
  - ignorar `audio/*`, `video/*`, `application/*`.
- Manter prioridade: thumbnail → imagem do HTML → YouTube.
- Testar podcast com áudio + imagem no HTML.

**Aceite:**

- [ ] Enclosure de áudio não vira thumbnail.
- [ ] Imagem no conteúdo ainda é usada.
- [ ] YouTube/Reddit continuam funcionando.

**Commit:** `fix(feed): only use image media as thumbnails`

---

### FIX-08 — Reddit: URL malformada não pode derrubar a API

**Problema:** `decodeURIComponent` em `redditPostInfo` pode lançar `URIError`; `/api/reddit-media` não trata e responde 500.

**Arquivos:**

- `src/lib/feed/reddit.ts`
- `src/lib/feed/reddit.test.ts`
- `src/routes/api/reddit-media/*.test.ts` se existir

**Mudança:**

- Envolver `decodeURIComponent` em `try/catch` e retornar `null`.
- Adicionar teste com `%E0%A4%A` no subreddit/slug.
- Garantir 400 na rota, não 500.

**Commit:** `fix(reddit): guard malformed percent-encoding`

---

## Fase 3 — Resiliência e segurança

### FIX-09 — `localStorage` seguro na home e no feed

**Problema:** `FeedBoard` e a nota rápida da home chamam `localStorage` sem proteção; armazenamento bloqueado derruba o componente.

**Arquivos:**

- `src/lib/browser-storage.ts` (novo)
- `src/lib/browser-storage.test.ts`
- `src/lib/components/FeedBoard.svelte`
- `src/routes/+page.svelte`

**Mudança:**

- `readLocal(key)`, `writeLocal(key, value)` com `try/catch`.
- Substituir acessos diretos em FeedBoard (visual, migração `grid`) e na nota rápida.
- Manter comportamento atual quando storage funciona.

**Testes:**

- Storage que lança em get/set não quebra.
- Valor inválido de visual cai no padrão.
- Migração `grid` continua.

**Aceite:**

- [ ] Home e feed abrem com storage bloqueado.
- [ ] Preferências continuam persistindo quando disponível.

**Commit:** `fix(storage): guard browser storage access`

---

### FIX-10 — Recuperação parcial de `estado.json`

**Problema:** um único snapshot inválido invalida o estado inteiro; o app cai para backup ou estado vazio, escondendo todos os lidos/salvos.

**Arquivos:**

- `src/lib/schema.ts`
- `src/lib/storage/json-file.ts`
- `src/lib/state-recovery.ts` (novo, se necessário)
- `src/lib/state-recovery.test.ts`

**Mudança:**

- Manter `parseHubState` estrito para escrita.
- Criar `recoverHubState(input)`:
  - valida topo (`version`, `read`, `saved`, `savedItems`);
  - remove snapshots inválidos individualmente;
  - remove IDs de `saved` sem snapshot? **Não** — manter e marcar para FIX-13;
  - remove `read` com valor não-string;
  - devolve `{ state, issues, removedSnapshots, removedRead }`.
- `loadState` usa `recoverHubState`; se o JSON estiver totalmente inválido, aí sim backup/vazio.
- Layout mostra aviso com contagem de itens recuperados.

**Testes:**

- Um snapshot inválido não apaga os outros.
- `read` inválido é removido sem perder o resto.
- JSON totalmente inválido continua fallback.
- Escrita posterior grava estado válido.

**Commit:** `fix(state): recover valid entries instead of discarding all`

---

### FIX-11 — SSRF: fixar IP validado e cobrir IPv6

**Problema:** `assertSafeUrl` resolve DNS e o `fetch` resolve de novo (DNS rebinding). `isPrivateIp` não cobre algumas formas IPv6 mapeadas.

**Arquivos:**

- `src/lib/net/safe-fetch.ts`
- `src/lib/net/safe-fetch.test.ts`
- possivelmente `src/lib/net/safe-fetch.node.ts`

**Mudança (proposta):**

- Implementar leitura de texto com `node:http`/`node:https` e `lookup` fixado no IP validado:
  - resolver uma vez;
  - rejeitar qualquer IP privado;
  - passar `lookup`/`servername` para a conexão;
  - seguir redirects manualmente, revalidando cada salto.
- Se a troca for grande demais, dividir:
  - FIX-11a: cobrir IPv6 mapeado em hexadecimal e ranges privados adicionais;
  - FIX-11b: pinagem de IP.
- Manter a interface `fetchPublicText` para os chamadores.

**Testes:**

- DNS que muda de público para privado não acessa o privado.
- `::ffff:7f00:1`, `::ffff:10.0.0.1` e ranges internos são bloqueados.
- Redirect para privado continua bloqueado.
- Feeds públicos continuam funcionando.

**Commit:** `fix(security): pin validated DNS address and expand IPv6 checks`

---

### FIX-12 — Fallback offline do service worker sempre responde

**Problema:** `caches.match('/offline.html')` pode devolver `undefined`; `respondWith(undefined)` gera erro. Não há timeout para servidor travado.

**Arquivos:**

- `static/sw.js`
- `src/lib/pwa.test.ts`

**Mudança:**

- `offlineResponse()`:
  - tenta `caches.match(OFFLINE_URL)`;
  - fallback para uma `Response` HTML mínima embutida.
- Navegação: `fetch(request, { signal: AbortSignal.timeout(8000) })` com fallback offline.
- Não cachear a resposta de fallback.
- Atualizar teste estático para exigir fallback e timeout.

**Aceite:**

- [ ] Cache limpo + offline mostra mensagem, não erro nativo.
- [ ] Servidor travado cai no offline em ~8 s.
- [ ] Navegação online não regride.

**Commit:** `fix(pwa): guarantee offline fallback and add navigation timeout`

---

### FIX-13 — Salvos legados sem snapshot

**Problema:** post salvo antes de existir snapshot e com fonte removida fica em `estado.json` mas não aparece em Favoritos.

**Arquivos:**

- `src/lib/feed/view.ts`
- `src/lib/components/FeedBoard.svelte` ou `FeedCard.svelte`
- `src/lib/feed/view.test.ts`

**Mudança:**

- `buildSavedView` devolve um item placeholder para IDs salvos sem dados:
  - título “Conteúdo indisponível”;
  - URL segura de fallback? **Não** criar link falso;
  - flag `missing: true` no `FeedViewItem`;
  - card mostra aviso e botão “Remover dos salvos”;
  - não tenta abrir imagem/player.
- Alternativa: seção “Salvos sem dados” com contagem e limpeza.
- Nunca apagar automaticamente.

**Testes:**

- ID salvo sem cache/snapshot aparece como indisponível.
- Remover limpa `saved`/`savedItems`.
- Itens normais não mudam.

**Commit:** `fix(saved): surface saved items without snapshot`

---

## Fase 4 — Menores

### FIX-14 — Memoizar índice de busca

**Problema:** `searchHub` reconstrói entradas e Fuse a cada tecla, apesar da promessa de índice memoizado.

**Arquivos:**

- `src/lib/search.ts`
- `src/lib/search.test.ts`
- `src/lib/components/CommandPalette.svelte`

**Mudança:**

- Cachear o índice por identidade/versão de `hub` e `feed`:
  - `WeakMap<HubData, ...>` e `WeakMap<FeedCache, ...>` ou chave `updatedAt` + contagem;
  - `searchHub` reutiliza Fuse; só reconstrói quando os dados mudam.
- Manter ordem/limite atuais.

**Testes:**

- Duas buscas seguidas com o mesmo hub/feed não reconstroem (spy/contador).
- Mudança no feed invalida o índice.
- Resultados continuam iguais.

**Commit:** `perf(search): memoize palette index`

---

### FIX-15 — OPML: não exportar `xmlUrl` insegura

**Problema:** `sourceOutline` usa `feedUrlFor` e escreve o target RSS sem validar `http(s)`; um alvo `javascript:` sai no OPML.

**Arquivos:**

- `src/lib/import/opml.ts`
- `src/lib/import/opml.test.ts`

**Mudança:**

- Passar o resultado por `toSafeHttpUrl`; se `null`, omitir a fonte.
- Aplicar a RSS/Reddit/YouTube.
- Teste com RSS `javascript:` e `file://` → fonte omitida.

**Commit:** `fix(opml): validate feed URLs on export`

---

### FIX-16 — Ordem de fontes coerente por categoria

**Problema:** a normalização mistura índice global e ordem por categoria; hubs parcialmente ordenados podem ter ordens duplicadas e listas planas intercaladas.

**Arquivos:**

- `src/lib/feed/order.ts`
- `src/lib/feed/order.test.ts`
- `src/routes/+page.svelte`, `src/routes/feed/+page.svelte`, `src/routes/c/[slug]/+server.ts`, `src/routes/gerenciar/+page.svelte`

**Mudança:**

- Definir uma regra só:
  - normalizar ordem **por categoria** (1..n, preservando a ordem visual atual);
  - criar `sortFeedSourcesForDisplay(sources, categories)` que ordena por categoria e depois por ordem;
  - usar essa função nas listas planas (home/feed) e a ordenação por ordem nos grupos do Gerenciar.
- `addSources`/`moveSource`/`updateSource` seguem a mesma regra.
- Teste com hub legado, parcial e novo.

**Aceite:**

- [ ] Fontes aparecem na mesma ordem antes/depois do load.
- [ ] Mover uma fonte não afeta outras categorias.
- [ ] Home/feed não intercalam categorias.

**Commit:** `fix(feed): normalize source order per category`

---

### FIX-17 — Cache do PWA com versão automática/limitada

**Problema:** `VERSION` é manual; a cada build entram novos arquivos hashed no mesmo cache, que cresce e mantém versões antigas.

**Arquivos:**

- `static/sw.js` ou migração para `src/service-worker.ts`
- `scripts/` e `package.json` se injetar versão no build
- `src/lib/pwa.test.ts`

**Opções (escolher uma antes de implementar):**

- **A (recomendada):** migrar para `src/service-worker.ts` usando `$service-worker`/`version` do SvelteKit, que muda a cada build.
- **B:** manter estático e gerar `sw.js` no build com um `BUILD_ID` injetado, além de limitar o cache (ex.: 100 entradas).
- **C:** manter manual, mas documentar o bump e adicionar poda por quantidade/tamanho.

**Aceite:**

- [ ] Build novo invalida o cache antigo.
- [ ] Cache não cresce indefinidamente.
- [ ] Offline continua funcionando.

**Commit:** `fix(pwa): version and bound the static cache`

---

### FIX-18 — Autostart: erros de `.env` e caminho do Node

**Problema:** `process.loadEnvFile('.env')` roda antes do logger; `.env` malformado falha sem log. O VBS depende de `node.exe` no PATH se `%ProgramFiles%` não existir.

**Arquivos:**

- `scripts/start.mjs`
- `scripts/start-hidden.vbs`
- `scripts/install-autostart.ps1`
- `src/lib/autostart.test.ts`
- `src/lib/startup.test.ts`

**Mudança:**

- Envolver `loadEnvFile` em `try/catch`; em erro, `logStartup` + `console.error` + exit 1.
- VBS tentar, nesta ordem:
  - `%ProgramFiles%\nodejs\node.exe`;
  - `%ProgramFiles(x86)%\nodejs\node.exe`;
  - `%LOCALAPPDATA%\Programs\nodejs\node.exe`;
  - `node.exe` no PATH;
  - se nenhum existir, gravar erro em `data\autostart.log` e sair.
- Install script valida Node 24+ e avisa se não.
- Testes: `.env` inválido gera log; VBS contém os caminhos alternativos.

**Commit:** `fix(win): log env errors and harden node discovery`

---

### FIX-19 — Erros de API claros (400/500) e sem vazamento interno

**Problema:** `/api/hub` e alguns endpoints retornam 500 ou mensagens internas para payload inválido; import/backup às vezes devolvem 500 onde caberia 400.

**Arquivos:**

- `src/routes/api/hub/+server.ts`
- `src/routes/api/state/+server.ts`
- `src/routes/api/import/+server.ts`
- `src/routes/api/backup/*`
- testes de rota

**Mudança:**

- Validar que o payload é objeto (Zod) antes de usar.
- Mapear erros de validação/parse para 400; manter 500 só para falhas inesperadas de I/O.
- Não devolver `error.message` de `TypeError`/`ReferenceError`; usar mensagem genérica.
- Testes: payload `null`, array, número; JSON válido mas tipo errado; status esperado.

**Commit:** `fix(api): validate payload shape and sanitize error responses`

---

## Validação final do plano

### Testes que devem existir ao fim

- [ ] Filtros salvos acompanham fonte/grupo.
- [ ] Ordem de itens ao mover categoria/grupo.
- [ ] Restore com rollback.
- [ ] Feed HTML/malformado retorna erro.
- [ ] Force refresh funciona durante scheduler.
- [ ] Atom `alternate`/`dc:date`.
- [ ] Thumbnail só imagem.
- [ ] Reddit `%` malformado → 400.
- [ ] Storage bloqueado não quebra home/feed.
- [ ] Estado parcialmente inválido recupera o resto.
- [ ] SSRF sem DNS rebinding.
- [ ] SW offline sempre responde.
- [ ] Salvos legados visíveis/removíveis.
- [ ] Busca memoizada.
- [ ] OPML export seguro.
- [ ] Ordem de fontes por categoria.
- [ ] Cache PWA versionado/limitado.
- [ ] Autostart loga `.env` inválido e acha Node.
- [ ] APIs retornam 400 claro.

### Critérios de aceite do plano

- [ ] `npm run verify` verde após cada fase.
- [ ] Nenhum dado pessoal commitado.
- [ ] Migrações/recuperação não apagam dados sem confirmação.
- [ ] HANDOFF/README atualizados ao fim de cada fase.
- [ ] Commits pequenos, um por FIX.

## Riscos

| Risco                                         | Mitigação                                                      |
| --------------------------------------------- | -------------------------------------------------------------- |
| Correção de ordem mexer em dados existentes   | Normalizar em memória e testar com hub legado; backup antes    |
| Recuperação de estado mascarar corrupção real | Aviso no layout + contagem de itens removidos                  |
| Pinagem de DNS quebrar feeds públicos         | Testes com fetcher mockado e smoke com feeds reais             |
| Migração do SW quebrar instalação existente   | Testar install/update/offline no Edge e limpar cache           |
| Autostart não testável sem logon              | Testar scripts em pasta temporária; validação final com o dono |

## Ordem de execução sugerida

1. FIX-01, FIX-02, FIX-03 (integridade).
2. FIX-04, FIX-05, FIX-06, FIX-07, FIX-08 (feed).
3. FIX-09, FIX-10, FIX-13 (resiliência de dados).
4. FIX-11, FIX-12 (segurança/PWA).
5. FIX-14 a FIX-19 (menores).
6. Rodada final de `npm run verify`, revisão e tag `v0.18.0`.

> **Não iniciar** sem autorização. Cada FIX deve ser uma branch/commit separado.
