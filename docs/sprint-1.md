# Sprint 1 — P0 de UX

> Data: 10/11/2026  
> Base: Sprint 0 (`v0.6.1`)  
> Status: implementado, aguardando teste manual dos fluxos interativos

## Entregas

| ID    | Entrega                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------ |
| UX-01 | Título do card virou link nas três visões, com foco visível.                                     |
| UX-02 | A Command Palette agora busca posts do feed, além de links, apps e categorias.                   |
| UX-03 | Deep links de “Adicionar” com aba, tipo, categoria e grupo.                                      |
| UX-04 | “Nova categoria” abre a criação; “editar” de grupo abre Grupos com foco no grupo.                |
| UX-05 | “Fontes com erro” conta apenas fontes ativas e mostra os nomes no tooltip.                       |
| UX-06 | Cache da fonte é limpo ao mudar `target`/`type` ou remover a fonte.                              |
| UX-07 | Métricas e fontes da home são clicáveis; feed aceita `?fonte=` e `?nao-lidos=1`.                 |
| UX-08 | Busca de salvos inclui o resumo; resumo também recebe destaque.                                  |
| UX-09 | “Marcar tudo como lido” pede confirmação e oferece desfazer por 10 s.                            |
| UX-10 | Terminologia principal unificada: Favoritos, Biblioteca, Fontes, Gerenciar, Link.                |
| UX-11 | Palette com clique fora, scroll lock, focus trap e retorno de foco.                              |
| UX-12 | Switch de fonte com `role="switch"` e `aria-checked`.                                            |
| UX-13 | Editor avisa antes de descartar alterações não salvas.                                           |
| UX-14 | Removida a opacidade dos cards lidos; textos pequenos maiores; accent gera contraste automático. |
| UX-15 | Favicon adicionado em `static/favicon.svg` e `app.html`.                                         |
| UX-16 | “Destacar se contiver” virou “Mostrar somente se contiver” / “Ocultar se contiver”.              |

## Arquivos principais

- `FeedCard.svelte`: título link, destaque no resumo.
- `FeedBoard.svelte`: fonte, não lidos, busca de salvos, confirmação/desfazer.
- `CommandPalette.svelte`: posts, focus trap, backdrop, scroll lock.
- `ManageEditor.svelte`: dirty guard, presets de categoria/grupo, textos de filtro.
- `HomeDashboard.svelte`: métricas ativas e clicáveis.
- `Sidebar.svelte`, `TopBar.svelte`: links contextuais.
- `gerenciar/+page.svelte`: deep links, status de erro, switch acessível, foco de grupo.
- `search.ts`, `display.ts`, `feed/cache.ts`, `api/state`, `api/hub`.
- `app.css`, `app.html`, `static/favicon.svg`.

## Verificação automática

```powershell
npm run verify
```

- 19 arquivos de teste.
- 177 testes.
- check, lint e build limpos.

## Teste manual recomendado

1. Abrir um post pelo título em Bento, Compacto e Completo.
2. `Ctrl K` e buscar um título de post do feed.
3. Na Biblioteca, clicar em “Adicionar item”; conferir a aba Itens.
4. Na categoria Jogos, clicar em “Adicionar em Jogos”; conferir categoria pré-selecionada.
5. Na Biblioteca, “editar” de um grupo; conferir foco no Gerenciar.
6. Marcar todos como lidos; confirmar; desfazer.
7. Abrir a palette e testar Tab/Shift+Tab, clique fora e rolagem do fundo.
8. Abrir o editor, alterar um campo e tentar fechar; conferir aviso de descarte.
9. Clicar em “fontes com erro” na home; conferir filtro no Gerenciar.
10. Trocar o `target` de uma fonte e confirmar que posts antigos saem do cache.

## Observações

- A checklist completa de regressão está em `docs/checklist-regressao.md`.
- A próxima fase recomendada é segurança: SEC-01, SEC-03, SEC-04 e SEC-05; depois SEC-02 com allowlist de iframes e imagens.
