# Fase 2 — triagem do feed

> Data: 10/11/2026  
> Base: `v0.11.0`  
> Escopo: ORG-07, ORG-08, ORG-10 e ORG-13

## Entregas

### ORG-07 — Não lidos por categoria e fonte

- `src/lib/feed/triage.ts` (`countUnread`) calcula totais por categoria e fonte.
- O layout passa `unreadByCategory` para a Sidebar.
- Sidebar mostra um badge de não lidos por categoria (só quando > 0), mantendo a contagem de itens/fontes.
- Chips de categoria e de fonte no feed mostram a contagem de não lidos.

### ORG-13 — Chips de fonte

- O feed ganhou uma linha **Fontes** com “Todas” + chips das fontes da categoria selecionada.
- Cada chip mostra os não lidos da fonte.
- Clicar alterna a fonte sem recarregar nem buscar de novo.
- Mudar de categoria remove uma fonte que não pertence à nova categoria.
- `?fonte=` continua funcionando e o chip “Fonte: X ×” limpa o filtro.

### ORG-08 — Marcar antigos como lido

- Botão **Marcar antigos** com **1 dia / 3 dias / 7 dias**.
- Age sobre a visão filtrada atual (categoria, fonte, busca e filtro salvo).
- Só marca posts não lidos com `publishedAt` anterior ao corte; datas inválidas ficam de fora.
- Usa o mesmo diálogo de confirmação e o desfazer em lote de 30 segundos.
- `src/lib/feed/triage.ts` (`idsOlderThan`, `cutoffDaysAgo`) concentra a lógica testável.

### ORG-10 — Filtros salvos com escopo

- `SavedFilter` ganhou campos opcionais `categoryId`, `sourceId` e `unreadOnly`.
- Schema valida referências; um filtro não pode apontar para categoria/fonte inexistente nem para fonte de outra categoria.
- Sem migração: campos opcionais, arquivos antigos continuam válidos.
- O formulário rápido de filtro permite escolher categoria, fonte e “Somente não lidos”.
- O editor de filtros no Gerenciar expõe os mesmos campos; limpar usa `null` e remove o escopo.
- Remover uma fonte/categoria limpa as referências dos filtros para não quebrar o schema.
- Enquanto um filtro com escopo está ativo, ele sobrepõe a barra; o chip de escopo resume “Categoria · Fonte · não lidos”.
- Clicar em outra categoria/fonte desativa o filtro e aplica a escolha manual.

## Arquivos principais

- `src/lib/feed/triage.ts` e `triage.test.ts`
- `src/lib/types.ts`, `schema.ts`, `hub-edit.ts`
- `src/lib/components/FeedBoard.svelte`, `Sidebar.svelte`, `ManageEditor.svelte`
- `src/routes/+layout.svelte`, `src/routes/feed/+page.svelte`, `src/routes/c/[slug]/+page.svelte`
- `src/app.css`

## Verificação

- `npm test`: **301/301** em 35 arquivos.
- `npm run check`: 0 erros/avisos.
- `npm run lint`: limpo.
- `npm run build`: ok.
- Servidor real:
  - filtro com escopo criado e validado no hub;
  - feed renderizou chips de fonte, contagens e resumo de escopo;
  - `?filtro=` aplicou o filtro salvo;
  - filtro de teste removido e estado preservado (41 leituras).
- Screenshot conferido em `/feed?filtro=...`.

## Fora deste bloco

- Marcação em massa por seleção manual (ORG-01) e drag & drop (ORG-02).
- Importação de bookmarks/OPML (ORG-04), quick add/bookmarklet (ORG-05) e tags como filtro (ORG-03).
- DATA-03 (progresso de refresh por fonte) e DATA-07 (migrações).
