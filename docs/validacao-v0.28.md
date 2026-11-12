# Validação manual — v0.28.0

Base: `master` em `v0.28.0` (691 testes, 99 arquivos; 15 testes E2E; CI verde).
Servidor local: `http://127.0.0.1:5757` (`npm start`).

> Marque os itens ao validar. O que já está coberto por teste automatizado aparece indicado.

## Reddit e feed

- [ ] `/feed` → **Atualizar agora**: r/Darktide verde, com posts.
  - Automatizado: `sources.test.ts` (URL canônica e reescrita de `/new.rss`), `safe-fetch-pin.test.ts` (UA e mensagem 429).
  - Verificado ao vivo em 12/11/2026: `count: 25`, `error: null`.
- [ ] Gerenciar → Fontes: status de r/Darktide recente, sem erro.
- [ ] Editar fonte Reddit com URL `.../new.rss` colada → salvar → atualizar (deve normalizar).
- [ ] Forçar limite (várias atualizações) → mensagem “limitou temporariamente as requisições (429)”.

## Primeiro uso

- [ ] Renomear `data/hub.json` → abrir `/` → painel de primeiro uso aparece.
- [ ] **Começar com exemplo** cria o hub e recarrega com conteúdo.
- [ ] **Começar vazio** cria hub sem categorias/itens.
- [ ] Restaurar o `hub.json` original.
  - Automatizado: `src/routes/api/setup/setup.test.ts`.

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

- [ ] `/api/health`: contagens, `writable: true`, sem token.
- [ ] `HUB_API_TOKEN=teste` no `.env` + reiniciar: POST `/api/hub` sem Bearer → 401; com `Authorization: Bearer teste` → passa.
- [ ] Backup: criar ponto em Gerenciar → Backups, baixar e restaurar (com ponto de segurança).
- [ ] Export → reimportar em cópia temporária de `data/`: itens, salvos e notas preservados.
- [ ] `data/notes.json` não aparece em `git status` (ignorado).

## Qualidade

- [ ] `npm run verify` verde.
- [ ] `npm run test:e2e` verde.
