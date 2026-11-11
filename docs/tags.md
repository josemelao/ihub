# Tags como filtro (ORG-03)

> Data: 11/11/2026
> Base: `v0.16.0`
> Tarefa: ORG-03

## Como funciona

- Tags vivem nos itens da Biblioteca (`item.tags`).
- Na **Biblioteca**, uma linha de chips mostra as tags com contagem, ordenadas por quantidade e nome.
- Clicar em `build · 2` mostra só os itens com essa tag; o chip **Todas** limpa o filtro.
- O filtro combina com busca, abas **Todos / Apps do PC / Navegador** e os acordeões de categoria.
- A URL reflete a escolha: `/biblioteca?tag=build`. Recarregar ou compartilhar o link mantém o filtro.

## Normalização

- Caixa, acento e espaços extras não criam tags diferentes: `Build`, `build ` e `BUILD` são a mesma tag.
- A primeira grafia encontrada é preservada na exibição.
- A normalização acontece ao carregar o hub e também ao salvar um item.
- Tags vazias são descartadas.
- O editor de item sugere as tags já existentes enquanto você digita.

## Renomear

Em **Gerenciar → Tags**:

- A lista mostra cada tag e quantos itens a usam.
- Edite o nome e clique em **Renomear**.
- A mudança vale para todos os itens de uma vez.
- Se o novo nome já existir, as tags são mescladas sem duplicar.
- Nome vazio é rejeitado; nome igual (ignorando caixa/acento) não faz nada.
- **Remover** tira a tag de todos os itens, sem apagar os itens; pede confirmação.

## Limitações

- Tags são dos **itens** (links/apps); posts do feed não têm tags.
- Não há cores, sinônimos ou hierarquia de tags.
- Não há exclusão automática; a remoção é explícita e confirmada.
- O filtro de tag não aparece em outras páginas além da Biblioteca.

## Estrutura

- `src/lib/tags.ts` — normalização, contagem, teste de tag e rename.
- `src/lib/schema.ts` — normalização no `parseHub`.
- `src/lib/hub-edit.ts` — normalização em add/update item.
- `src/lib/hub-actions.ts` — ação `rename-tag`.
- `src/routes/biblioteca/+page.svelte` — chips e `?tag=`.
- `src/routes/gerenciar/+page.svelte` — aba Tags.

## Verificação

- `npm run verify` verde; **433 testes** em 57 arquivos.
- Edge/CDP:
  - chips exibiram `build · 2`; clique levou a `?tag=build` com “2 itens encontrados”;
  - reload manteve `?tag=build` e o chip ativo;
  - renomear `build` → `Build final` atualizou os 2 itens e removeu `build`.
- Testes cobrem caixa/acento/espaço, contagem, merge no rename, remoção, vazio, parseHub e add/update.

## Checklist manual

1. Abrir a Biblioteca e clicar em uma tag; conferir a URL e a contagem.
2. Recarregar e compartilhar o link.
3. Combinar tag + busca + aba de tipo.
4. Renomear uma tag no Gerenciar e conferir os itens.
5. Renomear para o nome de outra tag e conferir a mesclagem.
6. Remover uma tag e conferir que os itens continuam.
7. Tentar renomear para vazio.
