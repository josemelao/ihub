# Fase de dados — integridade e concorrência

> Data: 10/11/2026  
> Base: `v0.8.0`  
> Backup: `data/backups/data-20261110-140201/`

## Entregas

### DATA-01 — Lock por arquivo e updates transacionais

- `src/lib/storage/mutex.ts`: fila de promises por chave (`Mutex`, `createLockRegistry`) com aquisição múltipla em ordem estável (sem deadlock).
- `HubStorage` ganhou:
  - `updateHub(fn)`;
  - `updateState(fn)`;
  - `updateFeedCache(fn)`;
  - `updateHubAndCache(hubFn, cacheFn)`.
- `JsonFileStorage` lê, aplica, valida e grava **dentro** do lock. O lock é por processo: dois processos Node no mesmo arquivo exigem PLAT-04.
- `/api/hub` e `/api/state` passaram a usar updates transacionais.
- `updateStateWithFallback` repara `estado.json` inválido com o backup/estado vazio; layout e `/api/state` usam esse caminho para não derrubar o app.
- Testes de concorrência:
  - 10 `read` simultâneos no endpoint → 10 presentes;
  - 10 filtros criados simultaneamente → 10 presentes;
  - 10 updates diretos em hub/estado/cache → nenhum perdido.

### DATA-02 — Coalescência de refresh

- `src/lib/feed/refresh-runner.ts`: no máximo um refresh por chave (`global` ou `source:<id>`) em andamento.
- Chamadas simultâneas recebem a mesma promise; falha libera a chave; fonte específica não bloqueia o refresh global.
- Scheduler e `/api/refresh` usam o mesmo `runRefresh`; o guard antigo `RUNNING_KEY` foi removido.
- O refresh grava o cache via `updateFeedCache` (transacional).

### DATA-04 — Gravação atômica no Windows/OneDrive

- `src/lib/storage/atomic.ts`: `writeFileAtomically` com:
  - temporário único por escrita;
  - retry de `rename` em `EPERM`/`EBUSY`/`EACCES` com backoff 50/100/200/400/800 ms;
  - fallback `copyFile` + `unlink`;
  - remoção do temporário em `finally`;
  - backup best-effort: se a cópia do `.bak` estiver bloqueada, a gravação principal continua e o `.bak` anterior é preservado;
  - erro final com caminho e código (`Não foi possível gravar … (EPERM)`).
- `writeJsonAtomic` usa o helper; nenhum `.tmp-*` fica para trás em erros tratados. Uma queda de energia durante o fallback `copyFile` pode deixar o arquivo parcial; o `.bak` cobre a recuperação.

### DATA-05 — Poda do estado

- `src/lib/state-prune.ts`: remove leituras com mais de **90 dias** (exceto posts salvos) e snapshots órfãos; grava `lastPrunedAt` quando muda.
- Poda roda no load do layout, reaplicada sobre o estado mais recente para não sobrescrever ações concorrentes.
- Idempotente; posts salvos nunca são podados.

### DATA-06 — Cache limpo junto com a fonte

- `updateHubAndCache` mantém hub e cache sob o mesmo lock.
- Remover ou trocar `target`/`type` de uma fonte limpa itens e status do cache.
- Se o cache estiver inválido, a operação é abortada **antes** de gravar o hub; erro de escrita do cache restaura o hub anterior.

### DATA-08 — Preview de importação e settings

- `src/lib/import-preview.ts`: diff por id (novos, atualizados, removidos) para cada coleção, contagem do estado e conflito de settings.
- `POST /api/import/preview` valida o bundle e devolve o preview; hub atual inválido cai para o backup.
- Gerenciar → Importar mostra “novos / atualizados / removidos” e, no modo mesclar, a escolha **Manter atual** ou **Usar do arquivo**.
- O preview descarta respostas fora de ordem ao trocar de modo; “Confirmar importação” só habilita com preview válido.
- `importBundle` aceita `settingsPolicy`; o padrão do merge agora é **manter** as settings atuais.
- Import roda sob os locks de hub/estado, lê e valida tudo antes de gravar e faz rollback do hub se a gravação do estado falhar.

### DATA-09 — Rotação de backups e pontos de restauração

- Cada gravação mantém `.bak` + `.bak.1` … `.bak.6` (7 gerações); a mais antiga é sobrescrita, nunca a mais nova.
- `load*FromBackup` tenta as gerações em ordem até achar uma válida.
- **Pontos de restauração** (`manual-*`):
  - `POST /api/backup` cria `data/backups/manual-<timestamp>/` com `hub.json`, `estado.json`, `feed-cache.json` e todas as gerações `.bak`, sob lock;
  - `GET /api/backup` lista os pontos com data, **caminho absoluto**, arquivos e tamanho;
  - `POST /api/backup/restore` valida o ponto, cria um **ponto de segurança** do estado atual e restaura hub/estado/cache;
  - `DELETE /api/backup/[id]` exclui o ponto manual (id validado, 400 se inválido/inexistente);
  - `GET /api/backup/download/[id]` baixa o ponto como JSON importável.
- Mantém os **10 pontos manuais mais recentes**; os mais antigos são removidos ao criar um novo.
- **Aba Backups** no Gerenciar (`/gerenciar?tab=backups`): criar, copiar caminho, baixar, restaurar e **excluir**.
- Excluir remove apenas a pasta `manual-*` escolhida; os `.bak` automáticos não são afetados.
- `GET /api/backup` também informa idade do backup automático e gerações.

### DATA-10 — Fallback na interface

- `HubStorage.loadHubWithFallback()` centraliza hub + backup + erro.
- `getStorage()` devolve `HubStorage`; o layout não conhece `JsonFileStorage`.

## Verificação

- `npm test`: **287/287** em 34 arquivos.
- `npm run check`: 0 erros/avisos.
- `npm run lint`: limpo.
- `npm run build`: ok.
- Servidor real:
  - 10 leituras concorrentes preservadas (e desfeitas depois);
  - ponto criado, listado com caminho absoluto, restaurado com ponto de segurança e baixado como JSON importável;
  - ponto de teste excluído pela API e removido da lista/disco;
  - restauração rejeitou `../hub.json` com 400;
  - preview do próprio export sem mudanças e sem conflito de settings;
  - fonte temporária criada e removida com cache consistente;
  - 3 gerações de backup após as escritas;
  - nenhum `.tmp-*` em `data/`.
- Revisão final apontou 1 crítico (estado inválido derrubava o layout) e 5 importantes; todos corrigidos com testes.

## Fora desta fase

- **DATA-03** (refresh concorrente com progresso por fonte/SSE): adiado para a fase de UX; o refresh segue síncrono, mas coalescido.
- **DATA-07** (migrações versionadas): o schema continua em `version: 1`; `lastPrunedAt` é opcional e compatível com arquivos antigos. Migrações entram quando houver mudança quebrante.
- Lock entre processos e SQLite continuam em PLAT-04/PLAT-12.

## Nota sobre CSRF em POSTs

Os POSTs e DELETEs da interface enviam `content-type: application/json`. O SvelteKit trata escrita sem `content-type` (ou `text/plain`/form) como submissão de formulário e responde **403 Cross-site POST form submissions are forbidden** antes de chegar ao handler.

O botão “Criar ponto de restauração” passou por esse problema em 10/11/2026 (POST vazio) e o “Excluir” também (DELETE sem header). A correção envia o header JSON e usa `readJsonResponse` para mostrar o status/corpo real quando a resposta não for JSON. Não desative o CSRF para “resolver” isso.
