# Organização manual — ordem de fontes e drag & drop

> Data: 11/11/2026
> Base: `v0.14.0`
> Tarefas: ORG-16 (ordem de fontes) e ORG-02 (drag & drop de itens)

## Ordem de fontes (ORG-16)

- `FeedSource.order` é opcional no JSON; no load, fontes sem ordem recebem a posição atual (1..n).
- Fontes novas entram no fim da própria categoria.
- Ao mudar a categoria de uma fonte pelo editor (ou mover um grupo), ela vai para o fim da categoria destino.
- Em **Gerenciar → Fontes**, cada linha tem **↑/↓**. O movimento troca apenas com a vizinha da mesma categoria.
- A ordem aparece na home, no feed completo, na categoria e no seletor de fonte dos filtros salvos.
- Arquivos antigos continuam válidos; a ordem é gravada na próxima alteração.

## Drag & drop de itens (ORG-02)

- Em **Gerenciar → Itens**, arraste pelo handle **⋮⋮** de uma linha.
- Solte sobre o cabeçalho/área de outro grupo (ou **Sem grupo**) para mover o item para o fim daquele grupo.
- Durante o arraste, **todos os grupos** (inclusive vazios) e um **Sem grupo** por categoria aparecem como destino; busca e filtro de tipo são ignorados temporariamente.
- O drop atualiza `categoryId` e `groupId` juntos; “Sem grupo” remove `groupId`.
- A ordem é recalculada e persistida via `POST /api/hub` (`move-item-to`), com validação Zod.
- Destaque visual na área de destino; o estado some ao soltar/cancelar.

### Fallbacks

- **Teclado:** os botões ↑/↓ continuam reordenando.
- **Mobile/touch:** HTML5 DnD não é confiável; use **Editar** para trocar categoria/grupo ou os botões ↑/↓.
- **Grupos vazios:** aparecem como destino apenas enquanto um item está sendo arrastado.

## Limitações

- DnD de **grupos**, **categorias** e **fontes** não entrou neste bloco; a reordenação continua por ↑/↓.
- O drop sempre adiciona ao **fim** do grupo; a posição exata dentro do grupo é ajustada com ↑/↓.

## Estrutura

- `src/lib/feed/order.ts` — normalização e ordenação de fontes.
- `src/lib/hub-edit.ts` — `addSources` (ordem), `moveSource`, `moveItemTo`.
- `src/lib/hub-actions.ts` — ações `move-source` e `move-item-to`.
- `src/routes/gerenciar/+page.svelte` — botões de fonte, DnD e drop zones.
- `src/app.css` — handle e destaque do drop target.

## Verificação

- `npm run verify` verde.
- **399 testes** em 52 arquivos.
- Edge/CDP:
  - “Abrir Darktide” saiu de Darktide e apareceu em “Risk of Rain Returns” (`category: jogos`, `group: risk-of-rain-returns`, `order: 5` no `hub.json`).
  - “Abrir Darktide” também foi solto em **Sem grupo** e persistiu sem `groupId`.
  - “r/Darktide (patch)” desceu uma posição e “Steam News” subiu; a ordem 1↔2 foi gravada no `hub.json`.
- Fallback por teclado e editor conferido por código; DnD de toque permanece no editor/↑↓.

## Checklist manual

1. Arrastar um item para outro grupo e recarregar.
2. Arrastar para “Sem grupo” e conferir que o grupo sumiu.
3. Mover uma fonte para cima/baixo, recarregar e conferir home/feed/categoria.
4. Abrir um `hub.json` antigo sem `order` e conferir que a ordem atual é preservada.
5. Mudar a categoria de uma fonte pelo editor e conferir que ela foi para o fim.
6. Usar ↑/↓ no teclado e o editor no mobile.
