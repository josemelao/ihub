# Captura rápida — favoritos, OPML e bookmarklet

> Data: 11/11/2026
> Base: `v0.13.2`
> Tarefas: ORG-04 (bookmarks/OPML) e ORG-05 (quick add/bookmarklet)

## O que entrou

### Importar favoritos do navegador (HTML)

Em **Gerenciar → Importar favoritos/OPML**, selecione o `bookmarks.html` exportado pelo Chrome, Edge ou Firefox.

- Pasta de primeiro nível → **categoria**.
- Pastas mais profundas → **grupo** (`Pasta / Subpasta`).
- Favoritos na raiz → categoria **Importados**.
- Escolhendo uma categoria no seletor **Organizar**, tudo vai para ela e as pastas viram grupos.
- Categorias e grupos existentes são reutilizados por nome (sem diferenciar maiúsculas/acentos).
- Links importados recebem a tag `importado`.
- URL repetida (já no hub ou no mesmo arquivo) é ignorada e contada como duplicata.
- `javascript:`, `place:`, `file:` e URLs vazias são descartadas.

### Importar OPML

O mesmo diálogo aceita `.opml`/`.xml`.

- `outline` com `xmlUrl` (ou `url`) → fonte de feed.
- `outline` sem URL → pasta.
- O tipo é inferido: feed do YouTube → `youtube`; `/r/<sub>/.rss` → `reddit`; resto → `rss`.
- Feeds duplicados são ignorados pelo `target`.
- Fontes novas entram com intervalo de 30 min, habilitadas e sem regras.
- Feeds na raiz → categoria **Feeds importados**.

### Exportar OPML

**Gerenciar → Exportar OPML** baixa `ihub-feeds.opml` com as fontes agrupadas por categoria/grupo. O arquivo reimporta sem perda de nome, URL ou pastas. Fontes cujo feed não pode ser resolvido (ex.: `@handle` do YouTube) são omitidas.

### Adicionar rápido

**Sidebar → Adicionar rápido** abre um diálogo com um campo de URL. O app busca título, descrição e ícone da página e abre o editor de link já preenchido.

- Se a página não puder ser lida (timeout, bloqueio, SSRF), o editor abre só com a URL; nada é bloqueado.
- O nome digitado no diálogo tem prioridade sobre o título da página.
- A busca usa `fetchPublicText` (bloqueia hosts internos, limite de 1 MB, timeout de 5 s).

### Bookmarklet

Em **Gerenciar → Itens**, arraste **Salvar no Hub** para a barra de favoritos. Em qualquer site, o clique abre o editor com `url` e `name` da aba atual.

- O bookmarklet é gerado a partir da origem do app (`http://127.0.0.1:5757`).
- Sites com CSP rígida podem bloquear `javascript:`; nesse caso, use **Adicionar rápido**.
- **Copiar código** copia o bookmarklet para cadastrar manualmente.

## APIs

| Rota                            | Função                                   |
| ------------------------------- | ---------------------------------------- |
| `POST /api/import/file/preview` | Valida e resume bookmarks/OPML           |
| `POST /api/import/file/apply`   | Aplica a importação (somente merge)      |
| `GET /api/export/opml`          | Baixa as fontes em OPML                  |
| `POST /api/link-metadata`       | Extrai título/descrição/ícone de uma URL |

Limite dos arquivos: **10 MB**. A importação nunca apaga nem sobrescreve dados existentes.

## Estrutura

- `src/lib/import/bookmarks.ts` — parser do HTML Netscape.
- `src/lib/import/opml.ts` — parser e exportador OPML.
- `src/lib/import/apply.ts` — merge puro no hub.
- `src/lib/import/file-import.ts` — dispatch e preview.
- `src/lib/import/detect-format.ts` — detecção por extensão/conteúdo.
- `src/lib/link-metadata.ts` — extração de metadados.
- `src/lib/quick-add.ts` — deep link do editor.
- `src/lib/bookmarklet.ts` — geração do bookmarklet.
- `src/lib/components/ImportFavoritesDialog.svelte`
- `src/lib/components/QuickAddDialog.svelte`
- `src/lib/components/BookmarkletCard.svelte`

## Verificação

- `npm run verify`: check, lint, testes e build verdes.
- **369 testes** em 46 arquivos.
- Casos cobertos: HTML aninhado, entidades, URLs perigosas, duplicatas, OPML aninhado/único, round-trip OPML, merge sem duplicar, metadados, fallback e bookmarklet.

### Checklist manual

1. Exportar favoritos do Chrome e importar; conferir categorias/grupos.
2. Reimportar o mesmo arquivo; conferir “duplicados”.
3. Importar um OPML e exportar de volta; reimportar sem duplicar.
4. Selecionar uma categoria fixa no diálogo; conferir que as pastas viraram grupos.
5. Adicionar rápido com um site online; conferir título/descrição.
6. Adicionar rápido com a rede desligada; conferir que o editor abre só com a URL.
7. Arrastar o bookmarklet em Chrome, Edge e Firefox e salvar uma página.
