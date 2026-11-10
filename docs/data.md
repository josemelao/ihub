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
  - erro final com caminho e código (`Não foi possível gravar … (EPERM)`).
- `writeJsonAtomic` usa o helper; nenhum `.tmp-*` fica para trás.

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
- `importBundle` aceita `settingsPolicy`; o padrão do merge agora é **manter** as settings atuais.

### DATA-09 — Rotação de backups e “Backup agora”

- Cada gravação mantém `.bak` + `.bak.1` … `.bak.6` (7 gerações); a mais antiga é sobrescrita, nunca a mais nova.
- `load*FromBackup` tenta as gerações em ordem até achar uma válida.
- `POST /api/backup` cria `data/backups/manual-<timestamp>/` com `hub.json`, `estado.json`, `feed-cache.json` e o `.bak` mais recente.
- `GET /api/backup` informa idade do backup automático, último manual, gerações e retenção.
- Gerenciar mostra “Backup automático: há X” e o botão **Backup agora**.

### DATA-10 — Fallback na interface

- `HubStorage.loadHubWithFallback()` centraliza hub + backup + erro.
- `getStorage()` devolve `HubStorage`; o layout não conhece `JsonFileStorage`.

## Verificação

- `npm test`: **259/259** em 32 arquivos.
- `npm run check`: 0 erros/avisos.
- `npm run lint`: limpo.
- `npm run build`: ok.
- Servidor real:
  - 10 leituras concorrentes preservadas (e desfeitas depois);
  - backup manual criado e detectado;
  - preview do próprio export sem mudanças e sem conflito de settings;
  - fonte temporária criada e removida com cache consistente;
  - 3 gerações de backup após as escritas;
  - nenhum `.tmp-*` em `data/`.

## Fora desta fase

- **DATA-03** (refresh concorrente com progresso por fonte/SSE): adiado para a fase de UX; o refresh segue síncrono, mas coalescido.
- **DATA-07** (migrações versionadas): o schema continua em `version: 1`; `lastPrunedAt` é opcional e compatível com arquivos antigos. Migrações entram quando houver mudança quebrante.
- Lock entre processos e SQLite continuam em PLAT-04/PLAT-12.
