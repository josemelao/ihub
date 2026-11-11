# Fase 2 — seleção em massa e teclado

> Data: 10/11/2026  
> Base: `v0.12.1`  
> Escopo: ORG-01 e ORG-09

## Entregas

### ORG-01 — Ações em massa

- Botão **Selecionar** no cabeçalho do feed.
- Checkbox sobreposto em cada card, sem alterar os três layouts do FeedCard.
- **Shift+clique** seleciona o intervalo; clique normal alterna; a seleção usa a ordem da lista filtrada.
- Barra fixa com:
  - contagem de selecionados;
  - **Marcar lido**, **Marcar não lido**, **Salvar**, **Remover dos salvos**;
  - **Selecionar todos os filtrados (N)**, **Limpar** e **Sair da seleção**.
- Seleção é limpa ao mudar busca, filtro, categoria, fonte ou “não lidos”.
- “Marcar lido” em lote reaproveita o desfazer de 30 segundos.
- Salvar/remover em lote mostram toast e atualizam Favoritos.

### Backend em lote

`/api/state` aceita:

- `save-many`: `{ entries: [{ id, snapshot? }] }`;
- `unsave-many`: `{ ids }`.

Todos os snapshots são validados antes de gravar; um inválido aborta o lote inteiro. Leitura continua usando `mark-all-read`/`mark-unread`.

### ORG-09 — Teclado

Quando o foco não está em campo de texto e não há diálogo/palette aberto:

| Tecla          | Ação                            |
| -------------- | ------------------------------- |
| `j` / `k`      | próximo / anterior card visível |
| `m`            | marcar lido / não lido          |
| `s`            | salvar / remover dos salvos     |
| `o` ou `Enter` | abrir o post                    |
| `?`            | ajuda de atalhos                |
| `Esc`          | sair da seleção / limpar foco   |

- Card focado ganha outline e rolagem para a vista.
- Ajuda em diálogo acessível (`ShortcutHelp.svelte`).
- Atalhos ignorados em `input`/`textarea`/`select`, conteúdo editável, modais e palette.

## Arquivos principais

- `src/lib/feed/selection.ts` + testes
- `src/lib/state-actions.ts` + testes
- `src/lib/components/FeedBoard.svelte`, `ShortcutHelp.svelte`
- `src/app.css`

## Verificação

- `npm test`: **313/313** em 36 arquivos.
- `npm run check`: 0 erros/avisos.
- `npm run lint`: limpo.
- `npm run build`: ok.
- Teste real com Edge via CDP:
  - 10 cards e 10 checkboxes;
  - clique + shift+clique → **3 selecionados**;
  - barra exibiu as 7 ações;
  - `?` abriu a ajuda;
  - `j` focou um card (`feed-slot.keyboard-focused`);
  - **Limpar** zerou a seleção.
- API em lote: `save-many` adicionou 1 salvo com snapshot e `unsave-many` restaurou a contagem original.
- Screenshots conferidos: barra de seleção com 3 cards marcados e diálogo de atalhos.

## Decisões

- Checkbox no wrapper do card, não dentro do FeedCard.
- “Selecionar todos” usa a lista filtrada completa, não só os 10 visíveis.
- Desfazer cobre leitura; salvar/remover em lote não têm undo nesta versão.
- `Enter` respeita botões/links focados para não sequestrar a ativação nativa.

## Correção v0.13.1 — checkbox e foco

Diagnóstico no navegador:

- a seleção mudava (barra 4 → 3 → 2 → 1), mas todos os `input.checked` ficavam `false`;
- o outline azul de teclado ficava preso no último card clicado porque `toggleSelect` definia `keyboardId` e nada limpava.

Correções:

- O checkbox nativo virou um `<button role="checkbox" aria-checked>` com ícone de check; o visual agora segue 100% o estado.
- Em modo de seleção, uma **superfície cobre o card inteiro**: clicar em qualquer lugar seleciona/desseleciona; shift+clique continua o intervalo.
- `keyboardId` só é definido por `j`/`k` e é limpo em qualquer `pointerdown`.
- O outline de teclado usa `.feed-slot.keyboard-focused`; o de seleção continua separado.

Validação via Edge/CDP:

- clique no corpo do card → 1 selecionado, `aria-checked=true`;
- shift+clique no terceiro → 3 selecionados;
- clique no primeiro de novo → 2 selecionados;
- nenhum outline após interação com mouse;
- `j` → outline sólido; clique → outline removido.
- Screenshot conferido com checkboxes marcados e sem borda presa.
- `npm test`: **313/313**.
