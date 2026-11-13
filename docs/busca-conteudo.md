# Busca no conteúdo dos salvos (READ-05, fatia 1)

> Implementado na `v0.32.0` sobre `v0.31.1`.
> Escopo: busca no texto extraído e nos destaques. Estatísticas de leitura ficam
> para a fatia 2 (`v0.32.1`).

## Por que

A busca de `/favoritos` cobria só título, resumo e nome da fonte. O gatilho real
é "eu li isso em algum lugar": a pessoa lembra de uma frase, não do título.
Destaque não exige salvar o post, então todos os destaques entram na busca —
inclusive de posts não salvos, numa seção separada. Deixá-los de fora produziria
o pior resultado possível: "eu marquei essa frase e a busca não acha".

## O que entra

| Fonte             | Onde está                    | Como é indexado                                                 |
| ----------------- | ---------------------------- | --------------------------------------------------------------- |
| Texto extraído    | `data/reading/<itemId>.json` | só posts salvos; texto limpo e truncado em 50.000 caracteres    |
| Destaques e notas | `highlights.json`            | todos; de posts não salvos vão para “Destaques fora dos salvos” |

Post salvo sem texto (nunca aberto no leitor e fonte sem “texto completo”)
aparece apenas se tiver destaque. A cobertura (`N de M salvos com texto`) é
exibida para explicar uma busca vazia.

## Como funciona

1. `GET /api/search/content?q=…&limit=50` (mínimo 2 caracteres).
2. `content-index` monta (uma vez por processo) a lista de documentos: metadados
   vêm de `state.savedItems`; o texto, de `storage.loadArticle`.
3. `content-search` (puro) normaliza termos (sem acento/caixa), exige **AND**,
   agrupa por post, gera um trecho de ~160 caracteres e deduplica: se um
   destaque casou e o mesmo trecho existe no texto, a linha do texto é omitida.
4. A resposta traz `groups` (salvos, ordenados por `savedAt`), `outside`,
   `coverage`, `total` e `hasMore`.

### Contrato

```json
{
	"query": "flamethrower",
	"total": 2,
	"hasMore": false,
	"coverage": { "saved": 37, "savedWithText": 12 },
	"groups": [
		{
			"itemId": "abc",
			"title": "Patch 1.2 chegou",
			"url": "https://exemplo/post",
			"sourceName": "r/Darktide",
			"saved": true,
			"savedAt": "2026-11-12T12:00:00.000Z",
			"matches": [
				{
					"kind": "text",
					"snippet": { "before": "…o dano do ", "match": "flamethrower", "after": " foi ajustado…" }
				}
			]
		}
	],
	"outside": []
}
```

`kind` é `text` ou `highlight`; destaques trazem `highlightId`, `color` e
`note`.

## Índice e invalidação

- Cache em memória por processo, com assinatura `versão|ids salvos`.
- `invalidateContentIndex()` roda em `getOrExtractArticle` (gravar artigo). O
  conjunto de salvos entra pela assinatura; destaques são lidos a cada consulta.
- Limitação: edição manual de `data/reading/*.json` exige reiniciar o servidor.
- Memória: até 500 salvos × 50k caracteres ≈ 25 MB no pior caso.

## Interface

- Alternador **Título** (padrão) · **Conteúdo** no campo de busca de Salvos; a escolha fica em `localStorage` (`meu-hub:saved-search-mode`).
- **Ordenar: Salvamento / Publicação** vale nos dois modos. No conteúdo, reordena os grupos por `savedAt` ou `publishedAt` (com fallback entre eles).
- Debounce de 250 ms, `AbortController`, mínimo de 2 caracteres.
- A barra de filtros do feed abre e fecha com `slide` de 160 ms (0 quando `prefers-reduced-motion`). No modo conteúdo, o contador “Mostrando X de Y” sai com slide horizontal, empurrando os chips em vez de sumir e causar salto.
- Uma linha por resultado, duas no máximo para o trecho; sem cards ou imagens.
- Termo destacado com `<mark>`; a busca marca **todos** os termos da consulta.
- Título abre `/ler/<id>`; na seção externa abre o original.
- Estados vazios explicam a cobertura; contagem em `aria-live`.

## Privacidade e limites

- Tudo local: nenhum texto sai da máquina.
- Só encontra conteúdo já extraído; extração em lote dos salvos não faz parte
  desta fatia.
- Sem busca fuzzy (Fuse): para frase/trecho, substring normalizada é mais
  previsível e mais rápida.
- Limite de 50 resultados (máx. 100 na API), “Mostrar mais” soma 20.

## Testes

- Unitários: `normalize`/`findSnippet`, `searchContent` (AND, dedupe, ordem,
  limite, seção externa) e `content-index` (cache, invalidação, truncamento,
  arquivo corrompido).
- Rota: 400 para busca curta, texto do salvo, destaque externo, limite e
  cobertura.
- E2E: busca real em `/favoritos`, destaque fora dos salvos, axe com resultados
  e 375 px sem overflow.

## Fatia 2 (depois)

Estatísticas sob o título: salvos, com texto, destaques, arquivados e minutos de
leitura (`ceil(palavras / 200)`), com `favoritos/+page.server.ts` e `stats.ts`.
