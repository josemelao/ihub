# Fase de segurança — implementado

> Data: 10/11/2026  
> Base: `v0.7.1`  
> Backup: `data/backups/security-20261110-132539/`

## Entregas

### SEC-01 — URLs seguras

- Novo helper `src/lib/net/url.ts`: `toSafeHttpUrl`, `isSafeHttpUrl`, `assertSafeHttpUrl`.
- O parser de feed descarta itens com link `javascript:`, `data:`, `file:`, `vbscript:` ou URL inválida.
- Thumbnails só entram se forem `http(s)`; as demais viram `null`.
- `/api/state` rejeita snapshot com item/URL/thumbnail insegura.
- `buildFeedView`/`buildSavedView` sanitizam ou ignoram URLs perigosas de cache/snapshot antigo.

### SEC-03 — Estado e cache validados

- `schema.ts` agora tem:
  - `stateSchema` (`read`, `saved`, `savedItems`);
  - `savedSnapshotSchema`;
  - `feedItemSchema`;
  - `feedCacheSchema`/`sourceStatusSchema`.
- `JsonFileStorage.loadState/loadFeedCache` validam com Zod.
- Falha de validação tenta `.bak`; sem backup, usa vazio e mostra aviso no layout.
- `saveState`/`saveFeedCache` também validam antes de gravar.
- Importação valida `bundle.state` **antes** de alterar o hub.

### SEC-04 — Limite de corpo

- Helper `src/lib/net/body.ts` (`readJsonLimited`).
- Limites:
  - `/api/hub`: 2 MB;
  - `/api/state`: 2 MB;
  - `/api/import`: 10 MB;
  - `/api/refresh`, `/api/discover-feed`, `/api/reddit-media`: 64 KB.
- Excesso retorna **413** sem gravar.

### SEC-05 — Fetch seguro no refresh

- `refreshFeed` usa `fetchPublicText`:
  - bloqueia localhost/IP privado;
  - valida cada redirect;
  - timeout de 10 s;
  - limite de 5 MB;
  - User-Agent e content-type permitidos.
- Teste real: fonte temporária apontando para `http://127.0.0.1:5757/` falhou com **“Host interno não permitido.”**.

### SEC-02 — Headers e CSP

- `src/hooks.server.ts` adiciona:
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: no-referrer`;
  - `X-Frame-Options: DENY`;
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
  - `Content-Security-Policy-Report-Only`.
- CSP em **Report-Only** com allowlist para:
  - YouTube (`youtube-nocookie.com`);
  - Reddit (`redditmedia.com`);
  - Google Fonts;
  - imagens `https:`;
  - scripts inline (temporário).
- Próximo passo: observar o console por alguns dias e então:
  1. trocar `content-security-policy-report-only` por `content-security-policy`;
  2. remover `'unsafe-inline'` de `script-src` usando nonce/hash do SvelteKit;
  3. remover Google Fonts quando PLAT-03 entrar.

## Verificação

- `npm test`: **201/201** em 23 arquivos.
- `npm run check`: 0 erros/avisos.
- `npm run lint`: limpo.
- `npm run build`: ok.
- Headers conferidos em `/`.
- Snapshot inválido rejeitado com 400.
- Corpo de 2,1 MB em `/api/hub` rejeitado com 413.
- SSRF bloqueado no refresh.

## Limitações restantes

- CSP ainda é Report-Only.
- `script-src` ainda permite inline.
- Google Fonts e Simple Icons/favicons continuam externos.
- Lock de escrita e concorrência (DATA-01/DATA-02) ainda pendentes.
