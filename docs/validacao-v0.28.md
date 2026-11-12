# Validação manual — v0.28.0

Base: `master` em `v0.28.0` (691 testes, 99 arquivos; 15 testes E2E; CI verde).
Servidor local: `http://127.0.0.1:5757` (`npm start`).

> **Validação concluída.** Automatizada em 12/11/2026 (este documento) e manual pelo dono em 12/11/2026. O que já é coberto por teste automatizado aparece indicado.

## Reddit e feed

- [x] `/feed` → **Atualizar agora**: r/Darktide verde, com posts.
  - Automatizado: `sources.test.ts` (URL canônica e reescrita de `/new.rss`), `safe-fetch-pin.test.ts` (UA e mensagem 429).
  - Verificado ao vivo em 12/11/2026: `count: 25`, `error: null`.
  - Causa de “atualizado mas vazio” investigada em 12/11/2026: o refresh funcionava, mas a fonte tinha `include: ["patch"]` e nenhum dos 25 posts continha "patch" — o `/feed` descartava todos na view. Filtro removido pelo dono; os cards do r/Darktide voltaram a renderizar (3 títulos conferidos no HTML SSR).
- [x] Gerenciar → Fontes: status de r/Darktide recente, sem erro.
- [x] Editar fonte Reddit com URL `.../new.rss` colada → salvar → atualizar (deve normalizar).
- [x] Forçar limite (várias atualizações) → mensagem “limitou temporariamente as requisições (429)”.

## Primeiro uso

- [x] Renomear `data/hub.json` → abrir `/` → painel de primeiro uso aparece.
  - Validado em 12/11/2026 com `HUB_DATA_DIR` temporário vazio (sem tocar no hub real): o HTML de `/` traz o painel com “Começar com exemplo/vazio”.
- [x] **Começar com exemplo** cria o hub e recarrega com conteúdo.
  - `POST /api/setup` → 200, `hub.json` criado, health com 5 categorias / 31 itens.
- [x] **Começar vazio** cria hub sem categorias/itens.
  - `POST /api/setup` → 200, health com 0 categorias, 0 itens, 0 fontes.
- [ ] Restaurar o `hub.json` original.
  - Não aplicável nesta rodada: o hub real não foi renomeado.
  - Automatizado: `src/routes/api/setup/setup.test.ts` (inclui o 409 quando já existe).

## Mobile e preferências

- [x] 375 px: ☰ abre o drawer; navegar fecha; Esc e backdrop também fecham.
- [x] Gerenciar → Aparência: densidade compacta, fonte 15, contraste alto → recarregar → persiste.
- [x] Título `(N) Meu Hub` + badge no favicon; some ao marcar tudo como lido.
- [x] Desktop 1440 sem regressão visual.
  - Automatizado: E2E `mobile.spec.ts` e `title.spec.ts`; axe em 4 telas.
  - Manual: validado pelo dono em 12/11/2026.

## Autostart (Windows)

- [x] `powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1` cria “Meu Hub” em `shell:startup`.
- [x] Logoff/logon: `127.0.0.1:5757` responde sem abrir terminal.
- [x] Fechar o terminal não derruba o servidor.
- [x] `scripts\uninstall-autostart.ps1` remove o atalho.
  - Automatizado: `src/lib/autostart.test.ts` (atalho, VBS, log de falha, versão do Node).
  - Manual: validado pelo dono em 12/11/2026; ao fim do fluxo o atalho não existe mais em `shell:startup` (desinstalado).

## Dados e segurança

- [x] `/api/health`: contagens, `writable: true`, sem token.
  - 12/11/2026: `writable: true`, `errors: []`, sem token no JSON.
- [x] `HUB_API_TOKEN=teste` no `.env` + reiniciar: POST `/api/hub` sem Bearer → 401; com `Authorization: Bearer teste` → passa.
  - 12/11/2026 (servidor temporário): POST `/api/backup` sem Bearer → 401; Bearer correto → 200; Bearer errado → 401; GET `/api/health` continua livre.
- [x] Backup: criar ponto em Gerenciar → Backups, baixar e restaurar (com ponto de segurança).
  - 12/11/2026 (dados temporários): criar → 200, listar → 1 ponto, download → 200, restaurar → 200 com ponto de segurança.
- [x] Export → reimportar em cópia temporária de `data/`: itens, salvos e notas preservados.
  - 12/11/2026: export com 5 categorias / 31 itens / 1 nota; import `replace` → 200; nota preservada.
- [x] `data/notes.json` não aparece em `git status` (ignorado).
  - `git check-ignore` confirma `.gitignore:34:data/notes.json`.

## Qualidade

- [x] `npm run verify` verde.
  - 12/11/2026: check, lint, check:e2e, testes e build OK.
- [x] `npm run test:e2e` verde.
  - 12/11/2026: 15/15 (Chromium reinstalado via `npx playwright install chromium`).
