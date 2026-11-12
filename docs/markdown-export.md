# Exportar salvos e destaques em Markdown (READ-04) — design

Data: 2026-11-12
Base: `v0.30.0`
Status: implementado na v0.31.0 em 12/11/2026; decisões do builder-check refletem o entregue.

## Por quê

O READ-02 deixou “Exportar gera Markdown legível” adiado. Quem usa Obsidian ou outro editor
Markdown precisa levar o que salvou (título, link, resumo, destaques e notas) sem depender do
hub. READ-04 fecha esse aceite com um ZIP de arquivos `.md`.

## Objetivos

- Exportar **um `.md` por item** que esteja salvo ou tenha destaques.
- Frontmatter YAML com título, URL, fonte, categoria, datas, salvo/arquivado e tags.
- Corpo com resumo, links (hub/original/arquivo) e destaques com nota e cor.
- `index.md` com a lista e contagens.
- Download único em ZIP; sem gravar arquivos temporários no disco.

## Não objetivos

- Converter o HTML arquivado inteiro para Markdown (fidelidade de página). O link para o
  `/arquivo/<id>` cobre quem quiser a página.
- Exportar itens da Biblioteca (links/apps) — o escopo é feed salvo/destaques.
- Sincronizar pastas ou gerar um vault Obsidian completo.
- Incluir imagens no ZIP.

## Anti-objetivos

- Gerar YAML inválido por título/nota com aspas, `:` ou quebra de linha.
- Nomes de arquivo colidirem ou saírem com acento/espaço.
- Perder destaques de itens não salvos.
- Bloquear a resposta carregando HTML/imagens do arquivo.

## Restrições

- Local-only; GET sem token (igual `/api/export`); nenhuma origem nova.
- Sem dependência pesada; ZIP em memória.
- Quando o storage está inválido, JSON de erro 500 (mesmo padrão de `/api/export`).

## Decisões

1. **Escopo do conteúdo:** um arquivo por item **salvo** (`state.saved`) ou com **destaque**
   (`highlights`). Itens só destacados saem com `saved: false`; nada é perdido.
2. **Conteúdo:** frontmatter + resumo + links + destaques. **Sem** texto completo extraído;
   links para `/ler/<id>` e `/arquivo/<id>` (quando existir).
3. **Entrega:** `GET /api/export/markdown` devolve um **ZIP** (fflate, ~8 KB) com
   `index.md` + um `.md` por item. Nome do ZIP: `meu-hub-export-AAAA-MM-DD.zip`.
4. **Nomes:** `<slug-do-título>-<7 primeiros do id>.md`; slug ASCII (sem acento/espaço) e id
   garante unicidade mesmo com títulos iguais.
5. **Tags:** categoria e fonte normalizadas (`jogos`, `fonte-e2e`), deduplicadas. Cores dos
   destaques não viram tags.
6. **Formato Obsidian-friendly:** frontmatter YAML válido, `index.md` com links relativos
   `[Título](arquivo.md)`; nada de wikilinks (portabilidade).
7. **YAML seguro:** strings entre aspas duplas com escape de `\` e `"`; quebras viram espaço;
   listas de tags com itens escapados.
8. **UI:** botão **Exportar salvos em Markdown** em Gerenciar → Backups, com dica do conteúdo.

## Decisões do builder-check

- **Entrada inclui o feed:** `MarkdownExportInput` ganha `feed: FeedCache` e `baseUrl: string`.
  Item só com destaque puxa fonte/categoria/resumo/data do item vivo do feed (e do hub); sem
  item vivo, só título/URL do destaque, com os demais campos vazios.
- **Link base vem da requisição:** a rota usa `event.url.origin`, então funciona em qualquer
  porta/host permitido. O builder puro recebe `baseUrl`; testes usam `http://127.0.0.1:5757`.
- **Salvo sem snapshot:** resolve pelo item vivo do feed; se também não existir, gera um arquivo
  stub (`title` = “Conteúdo indisponível”, `saved: true`, `url: ""`) em vez de sumir. Nada é
  omitido silenciosamente.
- **Precedência de metadados:** o snapshot manda (título, URL, fonte, categoria, datas); o hub e
  o feed preenchem só o que faltar. Tags usam a categoria/fonte resolvidas e são deduplicadas.
- **Nomes únicos:** `<slug>-<id completo>.md` (16 hex) evita colisão mesmo com títulos iguais.

## Modelo

```ts
interface MarkdownExportInput {
	hub: HubData;
	state: HubState;
	feed: FeedCache;
	highlights: HighlightsData;
	archives: ArchiveIndex;
	baseUrl: string;
	now: Date;
}

interface ExportedFile {
	name: string; // slug-id.md
	content: string;
}
```

## Frontmatter (exemplo)

```yaml
---
title: 'Post de teste E2E'
url: 'https://example.com/post-e2e'
source: 'Fonte E2E'
category: 'Jogos'
saved: true
publishedAt: '2026-11-12T...'
savedAt: '2026-11-12T...'
archived: true
tags:
  - 'jogos'
  - 'fonte-e2e'
---
```

## Corpo (exemplo)

```md
# Post de teste E2E

> Resumo do post.

[Ler no hub](http://127.0.0.1:5757/ler/e2e-post) · [Abrir original](https://example.com/post-e2e) · [Versão arquivada](http://127.0.0.1:5757/arquivo/e2e-post)

## Destaques

### amarelo · 12/11/2026

> trecho destacado

Uma nota.
```

## Review focus (entradas que podem morder)

1. Título/nota com `"`, `\`, `:` ou quebra de linha: YAML continua válido.
2. Títulos iguais ou vazios: nomes de arquivo únicos e não vazios.
3. Item só com destaque (não salvo): exportado com `saved: false`.
4. Nenhum salvo/destaque: ZIP com `index.md` explicando o vazio.
5. Muitos itens (200+): ZIP em memória sem travar e sem arquivos temporários.
6. Caracteres não-ASCII no título: slug ASCII, conteúdo preservado em UTF-8.
7. Storage inválido: 500 JSON, sem ZIP parcial.

## O que fica para o builder

- Textos e ordem visual do `index.md`.
- Estilo do Markdown (títulos, separadores) dentro do formato acima.
