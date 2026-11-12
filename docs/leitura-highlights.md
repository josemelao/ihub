# Leitura e destaques (READ-01/02) — design

Data: 2026-11-12
Base: `v0.28.0` + commits de fechamento da validação
Status: implementado na v0.29.0 em 12/11/2026; decisões abaixo refletem o que foi entregue.

## Desvios na implementação

- **Persistência:** em vez de um `reading.json` único, o texto fica em `data/reading/<itemId>.json`
  (um por artigo) e os destaques em `data/highlights.json`. Motivo: o HTML extraído pode ter
  centenas de KB por artigo; um arquivo único faria cada leitura carregar o acervo inteiro.
- **Destaques inline:** a v1 mostra os destaques em lista (fim do artigo e `/highlights`); o
  campo `occurrence` já é gravado para permitir renderização inline numa próxima versão.
- **Export Markdown:** o aceite “Exportar gera Markdown legível” foi adiado para READ-04; os
  destaques entram no export/import JSON do hub.
- **Backups manuais:** continuam cobrindo só hub/estado/cache, como já acontecia com
  `notes.json`; artigos e destaques entram apenas no export/import.

## Por quê

Hoje “Abrir” tira o usuário do hub e “Salvar para depois” não cumpre o nome: não dá para ler o
conteúdo no app, guardar uma cópia, marcar um trecho ou anotar por que salvou. READ-01 (reader
mode) e READ-02 (destaques e notas) fecham essa lacuna.

## Objetivos

- Reader sob demanda para fontes RSS, com toggle por fonte (padrão desligado).
- Extração server-side do conteúdo principal, resiliente e sanitizada.
- Cache local por item, com leitura offline do que já foi extraído.
- Destaques e notas por item salvo, com tela própria e busca.
- Destaques entram no export/import (artigos ficam locais).

## Não objetivos

- Contornar paywall. Se o site não entregar o texto, o reader cai no fallback.
- Reader para YouTube e Reddit (o conteúdo é vídeo/thread; permanece “Abrir”).
- Arquivar páginas não lidas, medir espaço e apagar arquivo (READ-03).
- Exportar Markdown/Obsidian (READ-04), busca full-text no corpo (READ-05), TTS (READ-06).
- Sincronizar entre PCs.

## Anti-objetivos (o que faria isso falhar mesmo “funcionando”)

- Renderizar HTML não sanitizado ou HTML bruto vindo da rede.
- Buscar texto completo de todas as fontes automaticamente ao salvar.
- Travar a interface enquanto o artigo é extraído.
- Perder destaques porque o post saiu do cache do feed.

## Restrições do projeto

- Node 24, SvelteKit 3, Svelte 5 (runes), TypeScript.
- Local-only em `127.0.0.1`; CSP enforced; nenhuma origem nova no CSP.
- Rede só via `fetchPublicText` (`src/lib/net/safe-fetch.ts`): SSRF, redirects, content-type,
  limite de bytes e timeout.
- Persistência em JSON local com escrita atômica e lock (`JsonFileStorage`); UI em pt-BR,
  identificadores em inglês.
- Testes com Vitest (puros e rotas com `HUB_DATA_DIR` temporário) e Playwright hermético.

## Decisões

1. **Extração:** `@mozilla/readability` sobre `linkedom`.
   - É o algoritmo do Firefox, maduro, e resolve o caso “página cheia de navegação”.
   - `cheerio` não identifica o conteúdo principal; extrator próprio seria manutenção e risco.
   - URLs relativas são resolvidas na sanitização com a `finalUrl`; não dependemos de
     `document.baseURI` do linkedom.
2. **Sanitização:** `sanitize-html` com allowlist.
   - Remove `script`, `style`, `iframe`, `on*`, `class`/`id`/`style` inline.
   - Links e imagens só `http(s)`; `a` ganha `rel="noopener noreferrer"` e `target="_blank"`;
     `img` ganha `referrerpolicy="no-referrer"` e `loading="lazy"`.
   - Mantém estrutura de leitura: títulos, parágrafos, listas, citações, código, tabelas,
     figuras e imagens.
3. **Persistência (refinamento da decisão de arquivo único):** um JSON por artigo +
   `highlights.json`.
   - O HTML extraído tem tipicamente 100–500 KB por artigo; um único `reading.json` faria cada
     abertura de reader carregar todos os artigos. Por isso:
     - `data/reading/<itemId>.json` → `ReadingArticle` (metadados + HTML sanitizado + texto).
     - `data/highlights.json` → `HighlightsData` (leve; carregado no layout para badge e busca).
   - Ambos locais, versionados e ignorados pelo Git; `highlights.json` segue o padrão de
     `notes.json` (lock, escrita atômica, `.bak`, export/import).
   - `itemId` de artigo precisa casar `^[A-Za-z0-9_-]{1,64}$` (ids do parser são hash hex).
4. **Quando e o que cachear:** sob demanda, no clique de leitura.
   - Sem TTL e sem refetch automático: artigo extraído é imutável até o usuário pedir de novo
     (ação manual futura; fora desta entrega).
   - Guarda HTML sanitizado + texto puro + metadados (`title`, `byline`, `siteName`, `excerpt`,
     `finalUrl`, `fetchedAt`).
   - Limites: download 5 MB (já no `safe-fetch`), HTML sanitizado ≤ 2 MB, texto ≤ 200k chars,
     no máximo 300 artigos (poda dos mais antigos por `fetchedAt` ao salvar).
   - Texto acima de 200k chars é **truncado** (o HTML completo é preservado, se ≤ 2 MB);
     `length` guarda o total original para a estimativa de leitura.
   - HTML sanitizado acima de 2 MB é **rejeitado**: erro legível, nada gravado.
5. **Onde o reader aparece:** rota `/ler/[id]`.
   - SSR entrega o artigo quando já existe cache (offline funciona).
   - Sem cache, a página mostra o shell e o cliente dispara a extração, com estado de carregando.
   - Fallback claro com “Abrir original” quando a extração falha.
6. **Toggle por fonte:** `feedSources[].fullText` (default `false`).
   - O botão “Ler aqui” aparece em cards de fontes RSS mesmo com o toggle desligado; a página
     do reader explica e oferece “Ativar texto completo nesta fonte”.
   - O toggle controla **novas extrações**, não a leitura: artigo já cacheado continua legível
     mesmo se o toggle for desligado depois.
   - “Ativar” grava `fullText: true` e **inicia a extração na hora**.
   - `POST /api/reader` devolve artigo cacheado quando existe; sem cache, responde 409
     (`code: "full-text-off"`) se o toggle estiver desligado.
   - YouTube/Reddit não têm reader.
7. **Destaques:** seleção de texto no reader, toolbar com quatro cores e “Anotar”.
   - Persistido em `highlights.json`; a lista aparece no fim do artigo e em `/highlights`.
   - Cor nunca é o único sinal: cada destaque mostra rótulo textual (“amarelo”, “verde”…) e
     ícone; contraste conferido por axe.
   - `quote` e `note` são texto puro (Svelte escapa); nada de HTML.
   - **v1 não renderiza destaque inline no texto**: a representação persistente é a lista. Para
     permitir inline depois sem quebrar o schema, cada destaque guarda `occurrence` (ordinal da
     ocorrência da mesma `quote` no texto no momento da criação).
   - Destacar **não exige salvar o post** e não salva automaticamente: destaques são
     independentes do estado de salvos.
8. **Resolução de `/ler/[id]`:** artigo em cache → item do `feed-cache.json` → snapshot em
   `state.savedItems` → 404.
   - Post removido do cache mas salvo continua legível pelo snapshot; se houver artigo em
     cache, continua abrindo offline.
   - Fonte desligada/removida não bloqueia a leitura do que já foi salvo/extraído.
   - `/highlights` sempre mostra o destaque, com link para o reader; se o reader der 404, o
     link “Abrir original” (guardado no destaque) continua funcionando.

## Modelo de dados

```ts
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface ReadingArticle {
	id: string; // FeedItem.id
	url: string;
	finalUrl: string;
	title: string;
	byline: string;
	siteName: string;
	excerpt: string;
	publishedAt: string; // do item, quando houver
	fetchedAt: string;
	length: number; // caracteres do texto extraído
	html: string; // sanitizado
	text: string; // texto puro, para fallback e busca
}

export interface ReadingHighlight {
	id: string;
	itemId: string;
	itemTitle: string;
	itemUrl: string;
	quote: string;
	note?: string;
	color: HighlightColor;
	/** Ordinal da enésima ocorrência idêntica da quote no texto (0-based). */
	occurrence: number;
	createdAt: string;
	updatedAt: string;
}

export interface HighlightsData {
	version: number; // 1
	highlights: ReadingHighlight[];
}
```

`ExportBundle` ganha `highlights?: HighlightsData`. Artigos não entram no bundle (arquivo local;
READ-04 pode mudar isso). Backups manuais continuam cobrindo só hub/estado/cache, como já
acontece com `notes.json` — limitação registrada, fora do escopo.

## Fluxos

- **Ativar full text:** Gerenciar → Fontes → editar fonte RSS → “Buscar texto completo”.
- **Ler:** card → “Ler aqui” → `/ler/[id]`; com cache abre na hora; sem cache extrai (spinner),
  sanitiza, grava e renderiza. Falha → mensagem + “Abrir original”.
- **Destacar:** selecionar texto → toolbar → cor ou “Anotar” → salva e aparece na lista.
- **Revisar:** `/highlights` lista por post, com busca por trecho/nota/título e link para o reader.
- **Offline:** artigo já extraído abre sem rede; sem cache, mensagem clara.

## Segurança

- Toda busca de página passa por `fetchPublicText` (bloqueia loopback/privado, valida redirect,
  limita 5 MB, só `text/html` e afins).
- Só HTML sanitizado é gravado e renderizado; `{@html}` recebe exclusivamente a saída do
  sanitizador.
- Links externos com `noopener noreferrer`; imagens sem referrer.
- Nome de arquivo derivado de `itemId` validado por regex (sem path traversal).
- Destaques e notas são texto puro; limite de 2.000 caracteres por campo.

## Review focus (entradas que podem morder)

1. Página com paywall/JS-only: extração falha → fallback claro, sem tela em branco.
2. HTML hostil: `<script>`, `onerror=`, `href="javascript:"`, `img src="data:"` → nada sobrevive.
3. Artigo gigante: download > 5 MB ou HTML extraído > 2 MB → erro legível, nada gravado.
4. Post removido do cache: `/ler/[id]` resolve por snapshot salvo antes de dar 404; destaque
   órfão continua visível em `/highlights` com “Abrir original”.
5. Seleção vazia ou atravessando elementos: toolbar não aparece ou não grava lixo.
6. Offline com e sem cache: cache abre; sem cache explica; aba não quebra.
7. Artigo com texto > 200k chars: texto truncado, `length` original; HTML > 2 MB é rejeitado.

## O que fica para o builder

- Tipografia/largura de leitura, posicionamento da toolbar e detalhes visuais.
- Textos de interface, desde que sigam o tom e a terminologia do app.
- Estratégia de poda além do limite de 300 (configurável depois).
