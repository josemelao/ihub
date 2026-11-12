# Arquivo/offline do item salvo (READ-03) — design

Data: 2026-11-12
Base: `v0.29.0`
Status: implementado na v0.30.0 em 12/11/2026; decisões do builder-check abaixo refletem o que foi entregue.

## Por quê

Hoje o post salvo depende do site original e do cache do feed. Se a URL sai do ar, o item
continua no snapshot, mas o conteúdo se perde. READ-03 guarda uma cópia local da página inteira
(HTML sanitizado + imagens), criada automaticamente ao salvar, para leitura offline e depois de
um 404.

## Objetivos

- Ao salvar um post, arquivar automaticamente a página inteira sanitizada e suas imagens.
- Ler o arquivo local mesmo offline ou se o original retornar 404.
- Mostrar quanto espaço os arquivos ocupam e permitir apagar um arquivo mantendo o snapshot.
- Status visível por item: arquivando, arquivado, falhou (com motivo e “tentar de novo”).

## Não objetivos

- Burlar paywall ou capturar conteúdo autenticado.
- Arquivar posts não salvos.
- Exportar/backupear os arquivos (ficam locais; export/backup continuam só hub/estado/notas/
  destaques). Registrado como limitação.
- Histórico de versões da mesma página.
- Vídeo/áudio: imagens são arquivadas; mídia pesada não.

## Anti-objetivos

- Executar script/iframe do site arquivado.
- Arquivar sem limite e encher o disco silenciosamente.
- Bloquear a resposta de “salvar” esperando download de imagens.
- Deixar arquivo órfão invisível após remover dos salvos.

## Restrições

- Local-only, CSP enforced, nenhuma origem nova.
- Rede só via `safe-fetch` (SSRF, redirects, content-type, limite, timeout).
- JSON + escrita atômica para metadados; arquivos binários gravados uma vez e servidos por rota
  local validada.
- pt-BR na UI, identificadores em inglês.

## Decisões

1. **Automático ao salvar.** O POST que salva responde primeiro; o arquivamento roda em segundo
   plano e grava status (`pending` → `ready`/`failed`). Falha não desfaz o salvar.
2. **Página inteira sanitizada + imagens locais.** Usa o `<body>` da página (não o extract do
   Readability), passa pelo mesmo sanitizador com allowlist ampliada e baixa as imagens
   `http(s)` para o disco. Links viram absolutos com `target="_blank"`.
3. **Storage:**
   - `data/archive/<itemId>/index.html` — documento completo (CSS mínimo injetado + body).
   - `data/archive/<itemId>/assets/<sha1>.<ext>` — imagens baixadas.
   - `data/archive.json` — índice `{ version, entries: { [id]: ArchiveEntry } }`, com status,
     erro, bytes, nº de assets e datas. Versionado; entra no `.gitignore`.
   - `itemId` validado por regex (mesmo padrão de `reading`); nomes de asset são hash + extensão
     derivada do content-type; nenhum caminho vem do site.
4. **Servição:** `GET /api/archive/[id]` devolve o HTML (nosniff, CSP já aplicada pelo hook);
   `GET /api/archive/[id]/assets/[name]` devolve a imagem com o content-type guardado. Página
   `/arquivo/[id]` mostra cabeçalho (título, tamanho, datas), “Abrir original”, “Remover
   arquivo” e o conteúdo num iframe `self`.
5. **Gatilho:** depois de salvar (single e `save-many`), `enqueueArchive(item, snapshot)`
   fire-and-forget. Um `Set` em memória evita jobs duplicados por item. Se o processo reiniciar
   no meio, o item fica `pending` e o usuário pode repetir.
6. **Remover dos salvos apaga o arquivo** (fire-and-forget). O snapshot já sai; manter arquivo
   sem entrada visível seria lixo. O botão “Remover arquivo” em `/arquivo/[id]` e em Gerenciar
   apaga só o arquivo e mantém o snapshot/salvo.
7. **Limites:** download de HTML 5 MB; HTML sanitizado ≤ 3 MB (senão falha); até 20 imagens por
   página, 2 MB por imagem e 20 MB no total (as que excederem são descartadas); concorrência de
   4 imagens e 2 arquivamentos simultâneos. **Teto global de 200 arquivos**: ao atingir, novos
   salvamentos ficam `failed` com mensagem “limite de arquivos; remova alguns em Gerenciar” —
   nunca apagamos sozinhos o arquivo de um item ainda salvo.
8. **Espaço em Gerenciar → Backups**, seção “Leitura arquivada”: total em MB, quantidade, lista
   (título, tamanho, status) e “Apagar”. O `/arquivo/[id]` também mostra o tamanho e apaga.
9. **Integração com o reader:** `/ler/[id]` mostra “Abrir versão arquivada” quando o arquivo
   existe (principalmente no fallback de extração/404). O reader limpo continua separado.
10. **Sanitização do HTML completo:** mesma allowlist do reader, sem `style`/`class`/`id`/
    `script`/`iframe`/`form`; `img` só `http(s)` e depois reescrito para o asset local; imagens
    que falham são removidas. CSS mínimo do app é injetado no documento arquivado; nenhum
    recurso remoto permanece.
11. **SVG não é arquivado** (risco de script); conta como imagem descartada. Formatos aceitos:
    png, jpeg, gif, webp, avif.
12. **Sem retry automático em loop.** Falha grava motivo; “Tentar de novo” chama
    `POST /api/archive {action:'retry', itemId}`.

## Decisões do builder-check

1. **Sem iframe.** `/arquivo/[id]` é uma rota que devolve o documento arquivado **como página
   de topo** (`+server.ts`), com CSP própria e mais estrita:
   `default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'none';
connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. O hook
   aplica essa CSP (e `x-frame-options: DENY`) quando o path começa com `/arquivo/`; as demais
   rotas seguem a CSP atual. O CSS do arquivo vem de `static/archive.css` (sem inline).
   A página de topo é somente leitura: cabeçalho com título/data/tamanho, “Abrir original” e
   “Voltar ao hub”. Apagar/retentar ficam no `/ler/[id]` e no Gerenciar (onde há JS).
2. **Itens já salvos:** não há backfill automático. `/ler/[id]` e Gerenciar mostram “Arquivar
   agora” quando o item está salvo e não tem entrada. `POST /api/archive {action:'archive'}`
   só aceita item salvo (409 caso contrário).
3. **Ciclo de vida:** dessalvar (single/`unsave-many`) apaga o arquivo. Import/restauração de
   backup **não** apagam (evita perda silenciosa); entradas órfãs (não salvas) aparecem em
   Gerenciar com a tag “não salvo” e podem ser removidas. “Remover arquivo”/dessalvar cancelam
   um job em andamento via `Set` de cancelados; o job verifica antes de gravar e limpa pasta
   parcial. `reconcileArchiveIndex()` roda no load de `/arquivo/[id]` e do Gerenciar: entrada
   `ready` sem `index.html` vira `failed` (“arquivo não encontrado”) e pode ser retentada.
4. **Allowlist ampliada:** estruturais `div, section, article, header, footer, main, nav, aside,
dl, dt, dd, time, details, summary, picture, source, mark, s, u, abbr, cite, q` além da lista
   do reader. Sem `style/class/id/on*/form/input/button/iframe/script/object/embed/link/meta/
base`. `img` usa só `src` (http(s)); `data-src`/`data-original` são promovidos a `src` quando
   `src` falta ou é `data:`; `srcset` é descartado; `picture/source` cai (o `img` interno fica);
   `data:` é descartado. `style-src 'self'` porque o CSS é externo.
5. **Elegibilidade:** só itens de fonte `rss` são arquivados; YouTube/Reddit ficam sem entrada e
   a UI explica “arquivamento disponível para fontes RSS”. Página cujo texto sanitizado tem
   menos de 100 caracteres vira `failed` (“conteúdo principal não encontrado”), mesmo que tenha
   imagens.
6. **Atualização de status:** `GET /api/archive` devolve o índice (entradas + total). `/ler/[id]`
   e Gerenciar fazem polling de 2 s enquanto houver `pending`, no máximo 30 tentativas, limpando
   o timer ao sair. Sem SSE.
7. **Teto de 200:** conta entradas `ready` + `pending` (slot reservado no enqueue, dentro do
   lock do índice); `failed` não conta. Teto adicional de 500 MB no total; atingido o teto, novo
   salvamento vira `failed` com mensagem para remover em Gerenciar. Nada é apagado sozinho.

## Modelo de dados

```ts
export type ArchiveStatus = 'pending' | 'ready' | 'failed';

export interface ArchiveEntry {
	id: string; // itemId
	status: ArchiveStatus;
	title: string;
	url: string;
	bytes: number; // soma de index.html + assets
	assets: number;
	error?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ArchiveIndex {
	version: number; // 1
	entries: Record<string, ArchiveEntry>;
}
```

## Fluxos

- **Salvar:** estado grava → `enqueueArchive` grava `pending` → busca HTML → sanitiza → baixa
  imagens → grava `index.html`/assets → `ready` (ou `failed` com motivo).
- **Ler offline:** favorito → “Ler aqui” → reader; se não houver artigo/falhar, “Abrir versão
  arquivada” → `/arquivo/<id>` → iframe do HTML local.
- **Apagar arquivo:** em `/arquivo/<id>` ou Gerenciar → remove pasta, assets e entrada; o post
  continua salvo/snapshot.
- **Dessalvar:** remove arquivo e entrada junto.

## Segurança

- HTML completo passa pelo sanitizador; nenhum script/on*/iframe/form sobrevive.
- Assets: só `image/png|jpeg|gif|webp|avif`, limite por arquivo/total, nome derivado de hash e
  content-type; servidos com `nosniff`, sem listagem e sem path do usuário.
- `safe-fetch` ganha caminho binário (`fetchPublicBytes`) reutilizando o pin de IP/redirects/
  timeout; erros e limites viram falha do arquivamento, nunca 500 na rota de salvar.
- Se o download de uma imagem falhar, o HTML é gravado sem ela; o arquivo continua legível.

## Review focus (entradas que podem morder)

1. Página gigante (> 5 MB HTML ou > 20 MB de imagens): falha/descarta com status claro, sem
   travar o salvar.
2. HTML hostil no body completo (`<script>`, `onerror`, `javascript:`, `iframe`): nada sobrevive.
3. Imagem com content-type errado/SVG/404: é descartada; HTML permanece.
4. Item removido dos salvos durante o arquivamento: job cancela/ignora e não deixa pasta órfã.
5. Disco cheio/permissão: status `failed` com motivo; nenhum arquivo parcial servível.
6. Offline/404 do original: `/arquivo/<id>` abre; sem arquivo, explica e oferece original.
7. Path traversal em `/api/archive/[id]/assets/[name]`: 400/404, nunca lê fora da pasta.

## O que fica para o builder

- CSS do documento arquivado e do iframe.
- Textos de interface e detalhes visuais.
- Estratégia de fila (Set/lock) desde que respeite concorrência e idempotência.
