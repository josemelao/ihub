# Validação manual — v0.28.0

Base: `master` em `v0.28.0` (691 testes, 99 arquivos; 15 testes E2E; CI verde).
Servidor local: `http://127.0.0.1:5757` (`npm start`).

> Marque os itens ao validar. O que já está coberto por teste automatizado aparece indicado.

## Reddit e feed

- [ ] `/feed` → **Atualizar agora**: r/Darktide verde, com posts.
  - Automatizado: `sources.test.ts` (URL canônica e reescrita de `/new.rss`), `safe-fetch-pin.test.ts` (UA e mensagem 429).
  - Verificado ao vivo em 12/11/2026: `count: 25`, `error: null`.
  - ⚠️ 12/11/2026: o refresh grava os 25 posts, mas a fonte tem `include: ["patch"]` e **nenhum** post contém "patch" — o `/feed` não exibe nenhum. Não é regressão do refresh; é o filtro da fonte. Limpar o termo em Gerenciar → Fontes → r/Darktide para validar visualmente.
- [ ] Gerenciar → Fontes: status de r/Darktide recente, sem erro.
- [ ] Editar fonte Reddit com URL `.../new.rss` colada → salvar → atualizar (deve normalizar).
- [ ] Forçar limite (várias atualizações) → mensagem “limitou temporariamente as requisições (429)”.

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

- [ ] 375 px: ☰ abre o drawer; navegar fecha; Esc e backdrop também fecham.
- [ ] Gerenciar → Aparência: densidade compacta, fonte 15, contraste alto → recarregar → persiste.
- [ ] Título `(N) Meu Hub` + badge no favicon; some ao marcar tudo como lido.
- [ ] Desktop 1440 sem regressão visual.
  - Automatizado: E2E `mobile.spec.ts` e `title.spec.ts`; axe em 4 telas.

## Autostart (Windows)

- [ ] `powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1` cria “Meu Hub” em `shell:startup`.
- [ ] Logoff/logon: `127.0.0.1:5757` responde sem abrir terminal.
- [ ] Fechar o terminal não derruba o servidor.
- [ ] `scripts\uninstall-autostart.ps1` remove o atalho.
  - Automatizado: `src/lib/autostart.test.ts` (atalho, VBS, log de falha, versão do Node).

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
