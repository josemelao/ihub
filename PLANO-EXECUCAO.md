# Plano de execução — Meu Hub (iHub)

> **Versão:** 1.1  
> **Data:** 10/11/2026  
> **Base analisada:** commit `d799914`  
> **Status:** Fase 1 (`v0.19.0`), ORG-06/12/17/18 (`v0.20.0`), PLAT-09 (`v0.22.0`), PLAT-08 (`v0.23.0`), PLAT-07/PLAT-10 (`v0.24.0`), PLAT-05 (`v0.25.0`), ORG-19 (`v0.26.0`), PLAT-11 (`v0.27.0`), leva Reddit/fechamentos (`v0.28.0`), READ-01/READ-02 (`v0.29.0`), READ-03 (`v0.30.0`), READ-04 (`v0.31.0`), ajustes de densidade + correção do dev em `/highlights` (`v0.31.1`) e READ-05 fatia 1, busca no conteúdo (`v0.32.0`) concluídos (SEC-02, DATA-03 e DATA-07 fechados); PLAT-03a (fontes locais) feito, proxy de imagem pendente. **v0.28.0 validada em 12/11/2026 (automação em ambiente isolado + validação manual do dono); PLAT-02 com logon real validado.** Escopo aprovado — Sprint 0, Sprint 1, fase de segurança, fase de dados, blocos de triagem e seleção em massa (ORG-01/07/08/09/10/13), captura rápida (ORG-04/05), organização manual (ORG-02/16), PWA (PLAT-01) e tags (ORG-03) executados.  
> **Escopo:** evolução do hub pessoal local (links + apps do PC + feed RSS/YouTube/Reddit)  
> **Observação:** versão versionada em `PLANO-EXECUCAO.md` na raiz do projeto. O plano completo também fica em `C:\Users\PICHAU\.opencode\plan\plano-execucao-ihub.md`.

---

## 0. Sumário executivo

O Meu Hub já tem uma base acima da média: arquitetura em camadas, validação forte do `hub.json`, escrita atômica com backup, feed funcional, testes (159 passando) e documentação boa. O plano abaixo não propõe reescrever o app. Ele ataca, em ordem:

1. **Fricções diárias de UX** que fazem a interface prometer algo e entregar outro (busca, adicionar, título clicável, terminologia).
2. **Integridade e segurança dos dados auxiliares** (`estado.json`/`feed-cache.json` sem validação, URLs sem allowlist, ausência de CSP, concorrência de escrita).
3. **Produtividade real**: importar favoritos/OPML, captura rápida, ações em massa, drag & drop, tags, atalhos e não lidos por categoria.
4. **Leitura e “salvar para depois”**: reader mode, texto completo, highlights, notas e arquivo.
5. **Plataforma e polimento**: PWA/autostart, fontes/ícones locais, privacidade, backup/sync, acessibilidade, CI e performance.

**Resultado esperado ao final do P0 + P1:** o app deixa de ter “becos sem saída” no uso diário, passa a resistir a dados corrompidos e a conteúdo malicioso de feed, e ganha o mínimo de produtividade para competir com a experiência de um start page/leitor pessoal.

**Resultado esperado ao final do P2 + P3:** o hub vira de fato sua homepage e seu read-later: captura em um clique, organiza em massa, lê o conteúdo sem sair, guarda highlights/notas e sobrevive à morte de links.

**Fora de escopo agora:** multiusuário, colaboração, nuvem, app mobile nativo, tema claro, compartilhamento público, execução de comandos e IA na nuvem. O diferencial do produto é ser **local, privado, rápido e seu**.

---

## 1. Contexto, baseline e princípios

### 1.1 Stack e estrutura atuais

- SvelteKit 3 + Svelte 5 (runes) + TypeScript strict.
- `@sveltejs/adapter-node`; `npm start` sobe o build em `127.0.0.1:5757`.
- Zod, Fuse.js, `fast-xml-parser`; apenas 3 dependências de runtime.
- Páginas: `/`, `/c/[slug]`, `/feed`, `/favoritos`, `/biblioteca`, `/gerenciar`, `/apps` (redirect).
- APIs: `/api/hub`, `/api/state`, `/api/feed`, `/api/refresh`, `/api/export`, `/api/import`, `/api/discover-feed`.
- Dados: `data/hub.json`, `data/estado.json`, `data/feed-cache.json`, com escrita atômica e `.bak`.

### 1.2 Baseline medido

| Item                  | Valor                                  |
| --------------------- | -------------------------------------- |
| Categorias            | 5                                      |
| Grupos                | 8                                      |
| Itens                 | 31 (7 apps + 24 links)                 |
| Fontes ativas         | 4 (RSS, YouTube, Reddit)               |
| Filtros salvos        | 5                                      |
| Posts em cache        | 51                                     |
| Salvos                | 2                                      |
| Testes                | 18 arquivos / **172 testes passando**  |
| CSS                   | 2.176 linhas em um único `app.css`     |
| Tag de baseline       | `v0.6.0`                               |
| Nota geral da análise | **8,0/10** para o escopo pessoal local |

> **Atualização desde `e43ab1b`:** Biblioteca com grupos/ícones, Favoritos com busca e ordenação, player de YouTube, lightbox de imagens, player do Reddit, interruptor de inglês por fonte Reddit, categorias recolhíveis e editor compacto. Esses recursos entram na checklist de regressão e não devem ser refeitos.

### 1.3 O que preservar em qualquer mudança

- Separação `types` / `schema` / `hub-edit` / `hub-actions` / `storage` / `feed`.
- Funções puras de edição e validação antes de gravar.
- Escrita atômica + `.bak` + fallback para backup.
- Um único caminho de mutação do hub (`/api/hub` + `applyHubAction` + `parseHub`).
- Privacidade local-first, sem login e sem nuvem.
- Português na UI, inglês no código, comentários em português.
- Testes antes/depois de cada mudança.

### 1.4 Princípios de execução

1. **Não reescrever o que funciona.** Evoluir por camadas e manter compatibilidade.
2. **Dado do usuário é sagrado.** Toda mudança de schema tem migração, backup e rollback.
3. **Segurança é requisito, não polimento.** URL de feed é conteúdo não confiável.
4. **Uma tarefa, um commit.** Commits pequenos, convencionais e reversíveis.
5. **Teste primeiro quando o comportamento é crítico.** Especialmente parser, storage, import e refresh.
6. **Acessibilidade desde a implementação.** Não deixar “depois”.
7. **Sem dependência nova sem justificativa.** Preferir o que já existe.
8. **Medir antes de otimizar.** Criar a baseline de performance antes do P2.
9. **Timebox.** Se uma tarefa passar do esforço estimado em 50%, parar e reavaliar.
10. **Nada de dados pessoais no Git.** `data/*.json` e `.env` ficam fora.

### 1.5 Definition of Done (DoD)

Uma tarefa só é considerada pronta quando:

- [ ] O comportamento foi implementado e testado manualmente no fluxo real.
- [ ] Há teste unitário ou de integração cobrindo o caso principal e o caso de erro.
- [ ] `npm test`, `npm run check` e `npm run lint` passam.
- [ ] Acessibilidade básica foi verificada (teclado + axe quando aplicável).
- [ ] Não há regressão visual nas três visões do feed e no mobile (375 px).
- [ ] `README.md`/`HANDOFF.md` foram atualizados quando a decisão muda o uso.
- [ ] Nenhum arquivo de `data/` ou `.env` foi commitado.
- [ ] O commit segue o padrão `tipo(escopo): descrição`.

### 1.6 Definition of Ready (DoR)

Antes de começar uma tarefa:

- [ ] O problema está reproduzido ou a decisão de produto está tomada.
- [ ] Os arquivos afetados estão identificados.
- [ ] O critério de aceite está escrito.
- [ ] Não há dependência bloqueante de outra tarefa.
- [ ] Há backup/export dos dados se a tarefa mexer em schema/migração.

### 1.7 Decisões e ajustes do Sprint 0

**Escopo aprovado:** executar primeiro o **P0 de UX**, depois **segurança** e **integridade de dados**. P2/P3 ficam para depois; reader mode, highlights, PWA, widgets e SQLite não entram agora.

| Tema            | Decisão                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Busca           | Incluir posts do feed na palette (Opção A), com limite e índice memoizado.                                                                                         |
| Terminologia    | Página **Favoritos**; ação **Salvar para depois**; contadores “posts salvos”. **Biblioteca** = links + apps; **Fontes** = origens do feed; **Gerenciar** = edição. |
| Notas           | Arquivo próprio `notes.json`, fora do `hub.json`, incluído no export.                                                                                              |
| Reader mode     | `@mozilla/readability` + `linkedom`, com sanitização; adiado para P2.                                                                                              |
| Sync            | Continuar pasta + detecção de conflito; sem serviço externo.                                                                                                       |
| Autostart       | VBS/atalho na pasta Startup primeiro; Task Scheduler depois, se necessário.                                                                                        |
| LAN             | Manter `127.0.0.1`; token opcional só se houver exposição na rede.                                                                                                 |
| Tema            | Manter somente dark.                                                                                                                                               |
| IA              | Sem IA na nuvem; qualquer IA local seria opcional e fora do escopo atual.                                                                                          |
| Retenção/backup | Lidos: 90 dias (nunca salvar itens lidos); backups: 7 gerações em `data/backups/`.                                                                                 |
| SQLite          | Só quando bater o critério (>5.000 posts, >500 itens, full-text/highlights ou múltiplos processos).                                                                |
| Read later      | Metadados + highlights primeiro; arquivo completo depois.                                                                                                          |
| CSP             | Fazer com allowlist para YouTube, Reddit, fontes e imagens; Report-Only antes de enforce.                                                                          |
| Migrações       | Usar defaults do Zod para campos opcionais; migração versionada só para mudanças quebrantes.                                                                       |
| CI              | Sem remote no Git; criar `npm run verify` local. GitHub Actions só quando houver remote.                                                                           |

**Baseline e checklist:** `docs/sprint-0.md` e `docs/checklist-regressao.md`.

---

## 2. Legenda de prioridade e esforço

| Código | Significado                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------- |
| **P0** | Impede uso confiável, causa perda de dados/segurança ou é fricção diária grave. Fazer primeiro. |
| **P1** | Produtividade e retenção. Sem isso, o app continua útil, mas “curto”.                           |
| **P2** | Diferenciação e deleite. Vale quando o núcleo estiver estável.                                  |
| **P3** | Opcional/experimental. Só com tempo sobrando.                                                   |

| Esforço | Estimativa                             |
| ------- | -------------------------------------- |
| **S**   | até 4 h                                |
| **M**   | 1–2 dias                               |
| **L**   | 3–5 dias                               |
| **XL**  | mais de 5 dias (quebrar em subtarefas) |

> Estimativas são para uma pessoa familiarizada com o código, em dias úteis. Não são deadline; são ordem de grandeza.

---

## 3. Visão geral do backlog

### 3.1 Fase 0 — Quick wins de UX (P0)

| ID    | Tarefa                                                          | Esforço | Impacto |
| ----- | --------------------------------------------------------------- | ------- | ------- |
| UX-01 | Título do card clicável nas 3 visões                            | S       | Alto    |
| UX-02 | Resolver a promessa da busca (feed na palette ou texto correto) | M       | Alto    |
| UX-03 | Deep links de “Adicionar” com contexto                          | M       | Alto    |
| UX-04 | “Nova categoria” e “editar grupo” contextuais                   | S       | Médio   |
| UX-05 | “Fontes com erro” considerar só fontes ativas                   | S       | Médio   |
| UX-06 | Limpar cache ao mudar `target`/`type` da fonte                  | S       | Médio   |
| UX-07 | Métricas e fontes da home clicáveis                             | S       | Médio   |
| UX-08 | Busca de salvos incluir resumo + destacar resumo                | S       | Médio   |
| UX-09 | Confirmação/Desfazer em “marcar tudo como lido”                 | M       | Alto    |
| UX-10 | Glossário e terminologia única                                  | S       | Alto    |
| UX-11 | Palette: focus trap, clique fora, scroll lock                   | S       | Médio   |
| UX-12 | Switch de fonte com semântica de switch                         | S       | Médio   |
| UX-13 | Aviso de alterações não salvas no editor                        | M       | Médio   |
| UX-14 | Contraste, opacidade de “lido” e tamanho mínimo de texto        | S       | Alto    |
| UX-15 | Favicon e metadados de app                                      | S       | Baixo   |
| UX-16 | “Destacar se contiver” → “Mostrar somente se contiver”          | S       | Médio   |

### 3.2 Fase 1 — Integridade, segurança e dados (P0/P1)

| ID      | Tarefa                                                         | Esforço | Impacto |
| ------- | -------------------------------------------------------------- | ------- | ------- |
| SEC-01  | Allowlist de `http(s)` para URL de feed/snapshot/import        | M       | Crítico |
| SEC-02  | CSP e headers de segurança                                     | M       | Crítico |
| SEC-03  | Zod para `HubState` e `FeedCache` + validação no import        | M       | Crítico |
| SEC-04  | Limite de tamanho de corpo nas APIs                            | S       | Alto    |
| SEC-05  | `safe-fetch` também no refresh de feeds                        | M       | Alto    |
| DATA-01 | API de update com lock por arquivo (read-modify-write atômico) | L       | Crítico |
| DATA-02 | Mutex/coalescência de refresh                                  | M       | Alto    |
| DATA-03 | Refresh concorrente com progresso por fonte                    | L       | Alto    |
| DATA-04 | Retry de `rename` e limpeza de temporários (Windows/OneDrive)  | M       | Alto    |
| DATA-05 | Podar/compactar `estado.json`                                  | M       | Médio   |
| DATA-06 | Limpar cache/status de fontes removidas                        | S       | Médio   |
| DATA-07 | Migrações de schema versionadas                                | L       | Alto    |
| DATA-08 | Preview/diff de importação e validação de estado               | M       | Alto    |
| DATA-09 | Rotação de backups e “backup agora”                            | M       | Alto    |
| DATA-10 | Abstração `loadHubWithFallback` no storage                     | S       | Baixo   |

### 3.3 Fase 2 — Produtividade e organização (P1)

| ID     | Tarefa                                                  | Esforço | Impacto |
| ------ | ------------------------------------------------------- | ------- | ------- |
| ORG-01 | Ações em massa + Desfazer                               | L       | Alto    |
| ORG-02 | Drag & drop com fallback de teclado                     | L       | Alto    |
| ORG-03 | Tags como filtro de primeira classe                     | M       | Alto    |
| ORG-04 | Importar bookmarks HTML + OPML (import/export)          | L       | Alto    |
| ORG-05 | Quick add + bookmarklet “salvar aba atual”              | M       | Alto    |
| ORG-06 | Palette de comandos + busca no feed/salvos/notas        | L       | Alto    |
| ORG-07 | Não lidos por categoria e por fonte                     | M       | Alto    |
| ORG-08 | “Marcar mais antigos que X como lido”                   | S       | Médio   |
| ORG-09 | Triagem por teclado (j/k/s/m/?)                         | M       | Alto    |
| ORG-10 | Filtros salvos com escopo (categoria/fonte/não lidos)   | M       | Médio   |
| ORG-11 | Links quebrados, duplicados e cache de favicons         | L       | Médio   |
| ORG-12 | “Testar fonte”/preview antes de salvar                  | M       | Médio   |
| ORG-13 | Chips de filtro por fonte no feed                       | S       | Médio   |
| ORG-14 | Página de grupo `/g/[slug]` + “abrir tudo do grupo”     | M       | Médio   |
| ORG-15 | Recentes/frecuência de uso (local)                      | M       | Médio   |
| ORG-16 | Ordem de fontes (campo `order` + migração)              | S       | Médio   |
| ORG-17 | Customização do Acesso rápido (fixar/desafixar/ordenar) | M       | Alto    |
| ORG-18 | Notas em storage próprio + export                       | M       | Alto    |
| ORG-19 | Primeiro uso: seed/assistente de configuração           | M       | Médio   |

### 3.4 Fase 3 — Leitura e salvos (P2)

| ID      | Tarefa                                               | Esforço | Impacto |
| ------- | ---------------------------------------------------- | ------- | ------- |
| READ-01 | Reader mode + texto completo                         | L       | Alto    |
| READ-02 | Highlights, notas e cores por item salvo             | L       | Alto    |
| READ-03 | Arquivo/offline do item salvo                        | L       | Alto    |
| READ-04 | Exportar salvos/highlights em Markdown/Obsidian      | M       | Médio   |
| READ-05 | Busca full-text nos salvos + estatísticas de leitura | M       | Médio   |
| READ-06 | Text-to-speech/podcast (opcional)                    | L       | Baixo   |

### 3.5 Fase 4 — Plataforma e polimento (P2/P3)

| ID      | Tarefa                                                        | Esforço | Impacto |
| ------- | ------------------------------------------------------------- | ------- | ------- |
| PLAT-01 | PWA/manifest/service worker/offline shell                     | M       | Alto    |
| PLAT-02 | Autostart no Windows + script de setup                        | M       | Alto    |
| PLAT-03 | Fontes/ícones locais, `no-referrer`, proxy de imagem          | L       | Médio   |
| PLAT-04 | Detecção de conflito de sincronização + backup rotativo       | L       | Alto    |
| PLAT-05 | API token opcional + `/api/health` + diagnóstico              | M       | Médio   |
| PLAT-06 | Widgets e layout configurável da home                         | L       | Médio   |
| PLAT-07 | Notificações e badge de não lidos no título/favicon           | M       | Médio   |
| PLAT-08 | Navegação mobile, densidade, tema e contraste                 | L       | Alto    |
| PLAT-09 | CI + testes de componente/e2e + axe                           | L       | Alto    |
| PLAT-10 | Refatorar CSS em tokens/arquivos + remover cores fixas        | M       | Médio   |
| PLAT-11 | Modelo de erro de storage + padronizar nomes                  | M       | Baixo   |
| PLAT-12 | Performance: memoização, virtualização e critério para SQLite | L       | Alto    |

### 3.6 Matriz impacto × esforço (resumo)

```
Alto impacto / baixo esforço  → FAZER JÁ
  UX-01, UX-05, UX-06, UX-07, UX-08, UX-10, UX-11, UX-12, UX-14, UX-16
  SEC-04, DATA-06, DATA-10, ORG-08, ORG-13, ORG-16

Alto impacto / esforço médio  → PRÓXIMO
  UX-02, UX-03, UX-09, UX-13
  SEC-01, SEC-02, SEC-03, SEC-05, DATA-02, DATA-04, DATA-08, DATA-09
  ORG-03, ORG-05, ORG-07, ORG-09, ORG-17, ORG-18

Alto impacto / alto esforço   → PLANEJAR
  DATA-01, DATA-03, DATA-07, ORG-01, ORG-02, ORG-04, ORG-06
  READ-01, READ-02, READ-03, PLAT-04, PLAT-08, PLAT-09, PLAT-12

Diferenciação / depois        → AVALIAR
  READ-04, READ-05, READ-06, PLAT-03, PLAT-05, PLAT-06, PLAT-07, PLAT-10, PLAT-11
```

---

## 4. Fase 0 — Quick wins de UX (P0)

> Objetivo: eliminar os “becos sem saída” e as promessas não cumpridas que aparecem todo dia. Fase curta, de alto retorno e baixo risco. Pode ser feita em um único sprint.

### UX-01 — Título do card clicável nas 3 visões

**Prioridade:** P0 · **Esforço:** S · **Depende de:** —

**Problema:** nas visões Bento e Completo o `<h3>` do título é texto puro; só a imagem e o ícone “Abrir” abrem o post. No Compacto o título é link. Isso quebra a expectativa mais básica de um leitor.

**Mudança:**

- Envolver o título em `<a href={entry.item.url} target="_blank" rel="noopener noreferrer">` nas três visões.
- Manter o `splitHighlights` dentro do link.
- Garantir foco visível e que o clique no link não dispare o card inteiro.

**Arquivos:** `src/lib/components/FeedCard.svelte`.

**Aceite:**

- [x] Em Bento, Compacto e Completo, clicar no título abre o post em nova aba.
- [x] Tab alcança o link do título em todas as visões.
- [x] O destaque de busca continua funcionando.
- [x] Nenhum `href` vazio/indefinido é renderizado.

**Testes:** manual nas 3 visões + teste de componente (quando a infra de componente existir).

---

### UX-02 — Resolver a promessa da busca

**Prioridade:** P0 · **Esforço:** M · **Depende de:** decisão de produto

**Problema:** o placeholder da TopBar diz “Buscar links, apps e posts do feed” e no feed diz “Buscar no feed”, mas a Command Palette só pesquisa links, apps e categorias (`searchHub`). O usuário digita o título de um post e não encontra.

**Decisão recomendada:** **Opção A** — incluir posts do cache na palette, com limite (ex.: 20 resultados) e indicador de tipo “Post”. É o que o usuário espera e reforça a proposta do hub.

**Opção B (mais barata):** manter a palette só com links/apps/categorias e trocar os textos para “Buscar links, apps e categorias”; no feed, focar o campo de filtro local em vez de abrir a palette.

**Mudança (Opção A):**

- `search.ts`: aceitar `feed` e `state` opcionais; criar entradas `type: 'post'` com título, fonte, resumo e URL.
- `CommandPalette.svelte`: receber `feed`/`state`; renderizar o tipo “Post”; ao escolher, abrir a URL externa.
- Limitar a 20 posts recentes/não lidos para não inflar o índice.
- Rebuild do índice memoizado por `hub`/`feed`/`state`, não a cada tecla.

**Arquivos:** `src/lib/search.ts`, `src/lib/components/CommandPalette.svelte`, `src/routes/+layout.svelte`, `src/lib/components/TopBar.svelte`.

**Aceite:**

- [x] Buscar por título de post retorna o post.
- [x] A paleta diferencia visualmente Link, App, Categoria e Post.
- [x] O índice não é reconstruído a cada tecla.
- [x] A busca continua rápida com 500 posts em cache.

**Testes:** unitário de `searchHub` com feed; manual de performance.

---

### UX-03 — Deep links de “Adicionar” com contexto

**Prioridade:** P0 · **Esforço:** M · **Depende de:** —

**Problema:** “Adicionar”, “Adicionar item” e “Adicionar em X” sempre levam para `/gerenciar`, que abre na aba **Fontes**. O usuário queria adicionar um link na categoria X e cai no lugar errado.

**Mudança:**

- Aceitar query params no Gerenciar: `?tab=itens&add=link&category=jogos&group=darktide`, `?tab=fontes&add=source`, `?tab=categorias&add=1`, etc.
- TopBar da Biblioteca: `?tab=itens&add=link`.
- TopBar da categoria: `?tab=itens&add=link&category=<id>`.
- Abrir o `ManageEditor` automaticamente e pré-selecionar categoria/grupo.
- Botão “Adicionar link”/“Adicionar app” no Gerenciar continua funcionando.

**Arquivos:** `src/lib/components/TopBar.svelte`, `src/routes/c/[slug]/+page.svelte`, `src/routes/biblioteca/+page.svelte`, `src/routes/gerenciar/+page.svelte`, `src/lib/components/ManageEditor.svelte`.

**Aceite:**

- [x] Da Biblioteca, “Adicionar item” abre o editor de link já na aba Itens.
- [x] Da categoria “Jogos”, o formulário abre com categoria Jogos.
- [x] “Cancelar” volta para a página de origem.
- [x] O deep link é compartilhável e sobrevive a reload.

---

### UX-04 — “Nova categoria” e “editar grupo” contextuais

**Prioridade:** P0 · **Esforço:** S · **Depende de:** UX-03

**Problema:** a sidebar tem “Nova categoria”, mas o link vai para Gerenciar/Fontes. Na Biblioteca, “editar” de um grupo vai para o Gerenciar genérico, sem foco no grupo.

**Mudança:**

- Sidebar: `?tab=categorias&add=1`.
- Biblioteca: `?tab=grupos&focus=<groupId>`; rolar até o grupo e destacá-lo por 2 s.
- Remover a impressão de que “Nova categoria” cria na hora; se quiser criar de fato, abrir um mini-dialog.

**Arquivos:** `Sidebar.svelte`, `biblioteca/+page.svelte`, `gerenciar/+page.svelte`.

**Aceite:**

- [x] “Nova categoria” abre a criação de categoria.
- [x] “editar” de um grupo abre Grupos com o grupo em foco.
- [x] O foco visual não quebra em mobile.

---

### UX-05 — “Fontes com erro” considerar só fontes ativas

**Prioridade:** P0 · **Esforço:** S · **Depende de:** —

**Problema:** o card “Resumo do dia” conta todas as fontes com `error` em `feed.sources`, inclusive desligadas. Desligar uma fonte quebrada não remove o alerta, porque o refresh ignora fontes desabilitadas e não limpa o erro.

**Mudança:**

- Contar apenas `hub.feedSources.filter(s => s.enabled && feed.sources[s.id]?.error)`.
- Ao desligar uma fonte, limpar `error` no cache (ou ignorar no cálculo).
- Exibir o nome das fontes com erro no tooltip e link para Gerenciar.

**Arquivos:** `HomeDashboard.svelte`, `refresh.ts`, `gerenciar/+page.svelte`.

**Aceite:**

- [x] Desligar uma fonte com erro remove o alerta da home.
- [x] O contador volta a subir se a fonte for religada e falhar.
- [x] O tooltip lista as fontes com erro.

---

### UX-06 — Limpar cache ao mudar `target`/`type` da fonte

**Prioridade:** P0 · **Esforço:** S · **Depende de:** DATA-01 (ideal) ou implementação simples no endpoint

**Problema:** os itens do cache são indexados por `source.id`. Ao trocar a URL de uma fonte, posts da URL antiga continuam aparecendo até a retenção de 30 dias.

**Mudança:**

- Em `updateSource`, detectar mudança de `target` ou `type`.
- Remover de `feed-cache.items` os itens daquele `sourceId` e zerar `sources[sourceId].count/lastFetchedAt` (ou marcar `stale`).
- Fazer isso dentro do endpoint que já lê/grava o cache, com lock (DATA-01).

**Arquivos:** `feed/refresh.ts` ou novo `feed/cache.ts`, `routes/api/hub/+server.ts`, `hub-edit.ts`.

**Aceite:**

- [x] Trocar a URL remove os posts antigos imediatamente.
- [x] A próxima atualização popula os posts novos.
- [x] Nenhum post de outra fonte é afetado.

---

### UX-07 — Métricas e fontes da home clicáveis

**Prioridade:** P0 · **Esforço:** S · **Depende de:** UX-02 (opcional)

**Problema:** “não lidos”, “salvos”, “posts hoje” e “fontes com erro” são só números. As fontes no aside também não são clicáveis.

**Mudança:**

- “Não lidos” → `/feed` com `?nao-lidos=1` (ou estado inicial de filtro).
- “Salvos” → `/favoritos`.
- “Fontes com erro” → `/gerenciar?tab=fontes&status=erro`.
- Cada fonte do aside → `/feed?fonte=<id>` (implementar filtro por fonte em ORG-13; até lá, `/feed`).
- “Posts hoje” pode abrir o feed com o filtro de data (se existir) ou `/feed`.

**Arquivos:** `HomeDashboard.svelte`, `routes/+page.svelte`, `routes/feed/+page.svelte`, `FeedBoard.svelte`.

**Aceite:**

- [x] Todo número/linha leva a uma visão coerente.
- [x] O filtro aplicado é visível e removível.
- [x] Funciona por teclado.

---

### UX-08 — Busca de salvos incluir resumo + destacar resumo

**Prioridade:** P0 · **Esforço:** S · **Depende de:** —

**Problema:** a busca de Favoritos usa só título + nome da fonte; o resumo é ignorado. E os matches no resumo do feed não são destacados — só no título.

**Mudança:**

- `savedFiltered`: incluir `entry.item.summary` no haystack.
- `FeedCard`: aplicar `splitHighlights` no `<p class="feed-summary">` também.
- Manter o destaque sem quebrar HTML (tudo é texto escapado pelo Svelte).

**Arquivos:** `FeedBoard.svelte`, `FeedCard.svelte`.

**Aceite:**

- [x] Buscar uma palavra que só existe no resumo encontra o salvo.
- [x] O trecho encontrado aparece destacado no resumo.
- [x] Sem regressão no destaque de título.

---

### UX-09 — Confirmação/Desfazer em “marcar tudo como lido”

**Prioridade:** P0 · **Esforço:** M · **Depende de:** —

**Problema:** marcar tudo como lido é instantâneo, irreversível e sem confirmação. Um clique errado apaga o estado de leitura de dezenas de posts.

**Mudança:**

- Diálogo de confirmação com a contagem (“Marcar 37 posts como lidos?”).
- Toast “37 posts marcados como lidos · Desfazer” por 10 s.
- “Desfazer” reaplica o estado anterior (enviar os ids que estavam não lidos).
- Não usar `confirm()` nativo; usar o `ConfirmDialog` existente.
- Considerar “marcar todos acima”/“mais antigos que X” em ORG-08.

**Arquivos:** `FeedBoard.svelte`, `ConfirmDialog.svelte`, `routes/api/state/+server.ts`.

**Aceite:**

- [x] A ação pede confirmação.
- [x] O toast permite desfazer e restaura exatamente o estado anterior.
- [x] Funciona com filtro aplicado (marca apenas o conjunto filtrado).
- [x] Acessível por teclado e com `role="status"`.

---

### UX-10 — Glossário e terminologia única

**Prioridade:** P0 · **Esforço:** S · **Depende de:** decisão de produto

**Problema:** “Favoritos”, “Salvos”, “Salvar para depois” e “posts salvos” disputam o mesmo conceito; “Links”, “Sites”, “Navegador” e “Web” idem. Isso gera dúvida sobre se são coisas diferentes.

**Decisão recomendada:**

- **Salvos** = posts guardados para ler depois. A página passa a se chamar “Salvos” (ou “Favoritos” se você preferir; escolha uma).
- **Links** = itens web; **Apps do PC** = itens por protocolo.
- **Fontes** = origens do feed.
- **Biblioteca** = links + apps.
- **Gerenciar** = edição.

**Mudança:**

- Criar `docs/glossario.md` ou seção no `README`.
- Substituir textos na sidebar, TopBar, cards, páginas e mensagens.
- Manter redirects/links antigos se renomear rota (não renomear `/favoritos` agora; só o rótulo).

**Aceite:**

- [x] Um termo por conceito em toda a UI.
- [x] O glossário está documentado.
- [x] Nenhum texto diz “Favoritos” e “Salvos” na mesma tela para a mesma ação.

---

### UX-11 — Palette: focus trap, clique fora, scroll lock

**Prioridade:** P0 · **Esforço:** S · **Depende de:** —

**Problema:** a palette tem `aria-modal="true"`, mas o foco pode sair para trás, o fundo rola e clicar no backdrop não fecha.

**Mudança:**

- `onclick` no backdrop: se `event.target === backdrop`, fechar.
- Focus trap: no mount, focar o input; no Tab/Shift+Tab, circular dentro do dialog; no unmount, devolver o foco ao gatilho.
- `document.body.style.overflow = 'hidden'` enquanto aberta; restaurar ao fechar.
- `aria-expanded` dinâmico; `aria-activedescendant` só quando houver resultado.
- `Escape` já funciona; manter.

**Arquivos:** `CommandPalette.svelte`, `+layout.svelte`.

**Aceite:**

- [x] Tab não escapa da palette.
- [x] Clicar fora fecha.
- [x] O fundo não rola.
- [x] O foco volta ao botão de busca ao fechar.
- [x] Teste com leitor de tela não anuncia conteúdo de trás como ativo.

---

### UX-12 — Switch de fonte com semântica de switch

**Prioridade:** P0 · **Esforço:** S · **Depende de:** —

**Problema:** o controle de ligar/desligar fonte é um `<button>` com `<span class="switch">`; leitores de tela não anunciam o estado.

**Mudança:**

- Adicionar `role="switch"` e `aria-checked={source.enabled}` ao botão.
- Manter `aria-label` (“Ligar fonte X” / “Desligar fonte X”).
- Estado visual já existe (`.switch.on`); alinhar com `:focus-visible`.

**Arquivos:** `gerenciar/+page.svelte`, `app.css`.

**Aceite:**

- [x] Leitor de tela anuncia “switch, ligado/desligado”.
- [x] Teclado alterna com Enter/Espaço.
- [x] O estado visual e o `aria-checked` nunca divergem.

---

### UX-13 — Aviso de alterações não salvas no editor

**Prioridade:** P0 · **Esforço:** M · **Depende de:** —

**Problema:** fechar o painel pelo X, pelo backdrop ou por Esc descarta o formulário sem aviso.

**Mudança:**

- Calcular `dirty` comparando o estado atual com o seed.
- Se `dirty`, interceptar fechamento e mostrar confirmação (“Descartar alterações?”) usando `ConfirmDialog`.
- Se não estiver `dirty`, fechar direto.
- Manter o foco e a rolagem.

**Arquivos:** `ManageEditor.svelte`, `dialog-backdrop.ts`.

**Aceite:**

- [x] Fechar sem mudanças não pergunta nada.
- [x] Fechar com mudanças pede confirmação.
- [x] “Cancelar” e “Salvar” continuam previsíveis.
- [x] O comportamento é o mesmo em todos os tipos de editor (link, app, fonte, categoria, grupo, filtro).

---

### UX-14 — Contraste, opacidade de “lido” e tamanho mínimo de texto

**Prioridade:** P0 · **Esforço:** S · **Depende de:** —

**Problema:** muitos textos em 11–12 px; em cards lidos, `opacity: 0.72` reduz o resumo/meta para cerca de 4,2:1, abaixo de 4,5:1. Cores de destaque fixas não acompanham o accent.

**Mudança:**

- Remover `opacity` do card lido; usar badge “lido” + cor de título mais suave (sem afetar contraste do resumo).
- Mínimo de 12 px para meta/tags; 13–14 px para resumo.
- Substituir `rgba(138,164,255,...)` fixo em `mark` e `library-badge` por `color-mix(in srgb, var(--accent) 25%, transparent)`.
- Validar contraste do accent personalizado: se `--on-accent` não tiver contraste suficiente, calcular preto/branco automaticamente.
- Testar com axe e com o tema em accent claro/escuro.

**Arquivos:** `app.css`, `display.ts`, `gerenciar/+page.svelte` (preview), `+layout.svelte` (accent).

**Aceite:**

- [x] Nenhum texto normal abaixo de 4,5:1.
- [x] Cards lidos continuam distinguíveis sem perder legibilidade.
- [x] Trocar o accent atualiza mark/badges.
- [x] Accent escuro não deixa botão primário ilegível.

---

### UX-15 — Favicon e metadados de app

**Prioridade:** P0 · **Esforço:** S · **Depende de:** PLAT-01 (para manifest completo)

**Problema:** existe `src/lib/assets/favicon.svg`, mas o `app.html` não o referencia. A aba fica sem identidade.

**Mudança:**

- Copiar/gerar `static/favicon.svg` e `static/favicon.ico` (ou usar o asset existente).
- Adicionar `<link rel="icon" ...>` no `app.html`.
- Adicionar `apple-touch-icon` e `theme-color` já existente.
- Deixar manifest para PLAT-01.

**Aceite:**

- [x] A aba mostra o ícone.
- [x] O ícone funciona em 16/32/180 px.
- [x] Nenhum 404 no console.

---

### UX-16 — “Destacar se contiver” → “Mostrar somente se contiver”

**Prioridade:** P0 · **Esforço:** S · **Depende de:** decisão de produto

**Problema:** no editor de fonte, “Destacar se contiver” sugere highlight, mas `matchesSourceRules` **remove** os posts que não casam. A expectativa e o comportamento divergem.

**Mudança (recomendada):**

- Renomear para “Mostrar somente se contiver” e “Ocultar se contiver”.
- Atualizar o texto de ajuda: “Aplica um filtro na exibição; não altera o cache.”
- Se quiser highlight de verdade, criar uma opção separada “Destacar no card” (P2).

**Arquivos:** `ManageEditor.svelte`, `refresh.ts`/`view.ts` (comentário), `README`.

**Aceite:**

- [x] O texto descreve exatamente o comportamento.
- [x] Nenhum usuário espera que “destacar” remova itens.
- [x] A documentação foi atualizada.

---

## 5. Fase 1 — Integridade, segurança e dados (P0/P1)

> Objetivo: tornar o app confiável sob concorrência, conteúdo malicioso e arquivos corrompidos. É a fase que evita “perder meus salvos” e “meu hub abriu esquisito”.

### SEC-01 — Allowlist de `http(s)` para URL de feed/snapshot/import

**Prioridade:** P0 · **Esforço:** M · **Depende de:** —

**Problema:** `parseFeed.linkOf` aceita qualquer string; o card renderiza `href={entry.item.url}`. Um feed malicioso pode publicar `javascript:...` ou outro esquema. O endpoint de save também aceita snapshot com URL arbitrária (só checa que é string), e o import grava `state` sem validar. Sem CSP, o impacto é maior.

**Mudança:**

- Criar `lib/net/url.ts` com `toSafeHttpUrl(value): string | null` e `assertSafeHttpUrl`.
- No parser: descartar item cujo `link` não seja `http(s)`; o mesmo para `thumbnail` (aceitar só `http(s)` ou `data:image` com limite? recomendado: só `http(s)`).
- No `/api/state` `save`: rejeitar snapshot se `item.url` não for `http(s)`; validar `thumbnail`.
- No import: validar `state` com Zod (SEC-03) e URLs com a allowlist.
- Em `buildSavedView`, usar fallback seguro se um snapshot antigo tiver URL inválida (não renderizar href).
- Testes com `javascript:alert(1)`, `data:text/html`, `file://`, `vbscript:`.

**Arquivos:** `src/lib/feed/parse.ts`, `src/lib/net/url.ts` (novo), `routes/api/state/+server.ts`, `storage/json-file.ts`, `feed/view.ts`, `schema.ts`.

**Aceite:**

- [x] Nenhum item de feed com esquema inválido entra no cache.
- [x] Nenhum snapshot com URL inválida é salvo.
- [x] Import rejeita bundle com URL inválida e mostra o caminho do problema.
- [x] Teste unitário cobre os esquemas perigosos.
- [x] Itens antigos inválidos não geram link clicável.

---

### SEC-02 — CSP e headers de segurança

**Prioridade:** P0 · **Esforço:** M · **Depende de:** SEC-01 (para não quebrar imagens)

**Problema:** não há CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors` nem `Permissions-Policy`. Qualquer XSS tem impacto máximo.

**Mudança:**

- Adicionar headers em `hooks.server.ts` (ou config de CSP do SvelteKit):
  - `Content-Security-Policy` com `default-src 'self'`, `img-src 'self' https: data:`, `style-src 'self' 'unsafe-inline'` (inicialmente), `script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: no-referrer`.
  - `X-Frame-Options: DENY` (ou `frame-ancestors`).
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Começar em **Report-Only** por 1–2 dias se o SvelteKit reclamar de inline/hydration; depois enforce.
- Ajustar `img-src` para os domínios de thumbnail/favicon permitidos; idealmente com proxy local (PLAT-03).
- Adicionar teste que verifica os headers nas respostas.

**Arquivos:** `src/hooks.server.ts`, `vite.config.ts` (se usar CSP config), `app.html`, testes.

**Aceite:**

- [x] Todas as páginas carregam com CSP enforced sem erro no console.
- [x] Imagens externas necessárias continuam funcionando.
- [x] `frame-ancestors` impede iframe.
- [x] Headers presentes em HTML e API; assets estáticos saem antes do hook do adapter-node (limitação aceita e documentada no README em v0.28.0).
- [x] Documentado no README como ajustar a CSP.

---

### SEC-03 — Zod para `HubState` e `FeedCache` + validação no import

**Prioridade:** P0 · **Esforço:** M · **Depende de:** —

**Problema:** só o `hub.json` é validado. `estado.json` e `feed-cache.json` são lidos com `as Partial<...>` e defaults. Um arquivo corrompido pode causar 500, perder favoritos ou injetar snapshot inválido. O import de `bundle.state` também não valida.

**Mudança:**

- `schema.ts`: criar `stateSchema`, `feedCacheSchema`, `savedSnapshotSchema`, `feedItemSchema`.
- `JsonFileStorage.loadState/loadFeedCache`: `safeParse`; em erro, tentar `.bak` e, se falhar, retornar estado vazio + registrar `stateError`/`cacheError` no layout.
- `importBundle`: validar `bundle.state` antes de gravar; se inválido, abortar **antes** de alterar o hub.
- `api/state` save: validar snapshot com o schema.
- Exibir aviso não fatal no layout quando estado/cache foram recuperados do backup.
- Testes com JSONs malformados (tipos errados, arrays no lugar de objetos, snapshot sem item).

**Arquivos:** `src/lib/schema.ts`, `storage/json-file.ts`, `routes/+layout.server.ts`, `routes/+layout.svelte`, `routes/api/state/+server.ts`, `api/import/+server.ts`.

**Aceite:**

- [x] Estado/cache inválidos não derrubam o app.
- [x] O app avisa que usou backup/vazio.
- [x] Import com estado inválido não grava nada.
- [x] Testes cobrem cada arquivo corrompido.

---

### SEC-04 — Limite de tamanho de corpo nas APIs

**Prioridade:** P0 · **Esforço:** S · **Depende de:** —

**Problema:** `/api/import`, `/api/hub` e `/api/state` leem o body sem limite. Um POST local grande pode consumir memória/disco.

**Mudança:**

- Helper `readJsonLimited(request, maxBytes)` que:
  - Rejeita `content-length` acima do limite.
  - Lê o stream com contador e aborta acima do limite.
  - Faz `JSON.parse` com try/catch.
- Limites sugeridos: hub 2 MB, state 2 MB, import 10 MB (ou 5 MB).
- Retornar 413 com mensagem clara.
- Teste de payload acima do limite.

**Aceite:**

- [x] Payload acima do limite retorna 413 sem gravar.
- [x] Payload normal continua funcionando.
- [x] O limite está documentado.

---

### SEC-05 — `safe-fetch` também no refresh de feeds

**Prioridade:** P1 · **Esforço:** M · **Depende de:** —

**Problema:** o discover bloqueia IP privado/loopback, mas o refresh usa `fetch` puro em `source.target` e segue redirects. Uma fonte cadastrada pode acessar serviços internos da máquina/rede.

**Mudança:**

- Usar `fetchPublicText` (ou uma variante que devolva `Response`/texto com limite) no `refreshFeed`.
- Manter `AbortSignal.timeout`, limite de 5 MB e UA.
- Resolver o URL final após redirects e validar cada salto (já feito no `safe-fetch`).
- Testes com URL `http://127.0.0.1`, `http://[::1]`, redirect para IP privado.

**Aceite:**

- [x] Fonte apontando para localhost/privado falha com mensagem clara.
- [x] Redirect para privado é bloqueado.
- [x] Feeds públicos continuam funcionando.
- [x] O status da fonte registra o erro.

---

### DATA-01 — API de update com lock por arquivo

**Prioridade:** P0 · **Esforço:** L · **Depende de:** SEC-03

**Problema:** hoje cada ação faz `load → mutate → save` fora de qualquer trava. Duas requisições simultâneas podem perder uma alteração (última vence). Travar apenas a escrita não resolve; o read-modify-write precisa estar dentro do lock.

**Mudança:**

- Criar `lib/storage/mutex.ts` com `withLock(key, fn)` baseado em fila de promises.
- Estender `HubStorage` com métodos transacionais:
  - `updateHub(fn: (hub) => HubData | Promise<HubData>)`
  - `updateState(fn: (state) => HubState | Promise<HubState>)`
  - `updateFeedCache(fn: (cache) => FeedCache | Promise<FeedCache>)`
- Implementar em `JsonFileStorage`: dentro do lock, ler, validar, aplicar, validar de novo, gravar.
- `api/hub`, `api/state`, `refreshAndSave` passam a usar os métodos transacionais.
- Manter `load*`/`save*` para leitura/export, mas não para mutação.
- Testes de concorrência: `Promise.all` de 10 updates concorrentes; todas as chaves devem estar presentes (ou updates serializados).
- Documentar que o lock é por processo (não cobre dois processos Node no mesmo arquivo; para isso, ver PLAT-04).

**Arquivos:** `src/lib/storage/json-file.ts`, `src/lib/storage/index.ts`, `src/lib/types.ts`, `routes/api/hub/+server.ts`, `routes/api/state/+server.ts`, `feed/scheduler.ts`.

**Aceite:**

- [x] 10 toggles concorrentes não perdem nenhum.
- [x] Duas abas não sobrescrevem o estado uma da outra.
- [x] O lock não bloqueia leituras (ou bloqueia por tempo mínimo).
- [x] Teste de estresse passa.

**Nota:** se o esforço crescer, uma alternativa é migrar `estado.json` para SQLite (ver PLAT-12), mas o lock é o caminho mais barato agora.

---

### DATA-02 — Mutex/coalescência de refresh

**Prioridade:** P1 · **Esforço:** M · **Depende de:** DATA-01

**Problema:** o guard `RUNNING_KEY` só protege o scheduler. O endpoint `/api/refresh` chama `refreshAndSave` direto; duas abas ou botão + scheduler podem rodar juntos, duplicar fetches e brigar pela escrita do cache.

**Mudança:**

- Um único `refreshInFlight: Promise<RefreshOutcome> | null` global.
- Se já houver refresh em andamento, retornar a mesma promise (coalescer) ou enfileirar um `force`.
- Scheduler e API usam a mesma função `runRefresh({ force, sourceId })`.
- Registrar `startedAt`, `sourceId`, progresso e resultado para a UI.
- Teste com duas chamadas simultâneas: apenas um conjunto de fetches.

**Aceite:**

- [x] Duas chamadas simultâneas não duplicam requisições.
- [x] A segunda recebe o resultado da primeira.
- [x] Refresh individual (`sourceId`) não conflita com o global.

---

### DATA-03 — Refresh concorrente com progresso por fonte

**Prioridade:** P1 · **Esforço:** L · **Depende de:** DATA-02

**Problema:** `refreshFeed` percorre as fontes em série, com timeout de 10 s por fonte. Com 10–20 fontes, o botão pode ficar “Atualizando...” por minutos, sem feedback.

**Mudança:**

- `mapWithConcurrency(sources, limit=4, fn)`.
- Resultado por fonte com `durationMs`, `ok`, `count`, `error`.
- API:
  - **Curto prazo:** manter síncrona, mas com concorrência 4; retornar `results`.
  - **Recomendado:** `POST /api/refresh` inicia job e retorna `{ jobId }`; `GET /api/refresh/status` (ou SSE) devolve progresso. UI mostra “3/10 fontes”.
- Timeout total configurável; cancelamento opcional.
- Scheduler usa o mesmo job.
- Teste com 10 fontes e fetcher mockado com delays; verificar limite de concorrência e ordem de conclusão.

**Aceite:**

- [x] 10 fontes com 100 ms cada terminam em < 2 s.
- [x] A UI mostra progresso e não trava.
- [x] Uma fonte lenta não bloqueia as demais.
- [x] Erros continuam isolados por fonte.

---

### DATA-04 — Retry de `rename` e limpeza de temporários (Windows/OneDrive)

**Prioridade:** P1 · **Esforço:** M · **Depende de:** DATA-01

**Problema:** no Windows, `rename` pode falhar com `EPERM`/`EBUSY` quando OneDrive/antivírus segura o arquivo. O temporário pode ficar órfão.

**Mudança:**

- `renameWithRetry`: 5 tentativas com backoff (50, 100, 200, 400, 800 ms) para `EPERM`, `EBUSY`, `EACCES`.
- Fallback: `copyFile(temp, final)` + `unlink(temp)` se `rename` não funcionar.
- `try/finally` para remover o `.tmp-*` em caso de erro.
- Logar o caminho e o código do erro (sem vazar conteúdo).
- Teste simulando `rename` com erro (mock de `node:fs/promises`).

**Aceite:**

- [x] Salvar em pasta do OneDrive não falha intermitentemente.
- [x] Nenhum `.tmp-*` fica para trás em caso de erro.
- [x] O erro final é claro para o usuário.

---

### DATA-05 — Podar/compactar `estado.json`

**Prioridade:** P1 · **Esforço:** M · **Depende de:** SEC-03

**Problema:** `state.read` guarda todo id lido para sempre; `savedItems` guarda snapshots; o arquivo é reescrito inteiro a cada ação.

**Mudança:**

- Podar `read` com mais de 90/180 dias e que não esteja salvo (configurável).
- Remover `savedItems` de ids que não estão em `saved`.
- Registrar `lastPrunedAt`.
- Rodar poda no load (com limite de tempo) ou em job diário.
- Testes com entradas antigas/novas.
- Considerar formato mais compacto (`{id: timestamp}` já é).

**Aceite:**

- [x] `estado.json` não cresce indefinidamente.
- [x] Posts salvos nunca são podados.
- [x] A poda é idempotente.
- [x] Documentar a retenção.

---

### DATA-06 — Limpar cache/status de fontes removidas

**Prioridade:** P1 · **Esforço:** S · **Depende de:** DATA-01

**Problema:** ao remover uma fonte, os itens e o status continuam em `feed-cache.json` até a retenção.

**Mudança:**

- Em `removeSource`, limpar `feed-cache.items` e `feed-cache.sources[id]` na mesma operação transacional.
- O mesmo ao trocar `target`/`type` (UX-06).
- Teste: remover fonte e verificar cache limpo.

**Aceite:**

- [x] Nenhum item órfão permanece.
- [x] O status não aparece em lugar nenhum.
- [x] A operação é atômica com a remoção do hub.

---

### DATA-07 — Migrações de schema versionadas

**Prioridade:** P1 · **Esforço:** L · **Depende de:** SEC-03

**Problema:** existe `version: 1`, mas nenhuma migração. Mudanças futuras (ordem de fontes, escopo de filtros, quick access) quebrariam dados antigos.

**Mudança:**

- `lib/migrations/hub.ts`, `state.ts`, `cache.ts` com `migrate(raw): { data, from, to, notes }`.
- Cadeia `v1 → v2 → v3`; cada passo puro e testado com fixture.
- Antes de migrar: copiar `hub.json` para `hub.json.pre-v2.bak` (ou backup rotativo).
- Validar antes e depois; se falhar, abortar e manter o original.
- `version` no arquivo reflete a versão atual.
- Documentar no README/HANDOFF.
- Testes com fixtures v1 reais (podem ser anonimizadas).

**Aceite:**

- [x] Abrir um hub v1 migra para v2 sem perder dados.
- [x] Migração é idempotente.
- [x] Falha de migração não altera o arquivo original.
- [x] Existe teste de rollback (restaurar backup).

---

### DATA-08 — Preview/diff de importação e validação de estado

**Prioridade:** P1 · **Esforço:** M · **Depende de:** SEC-03

**Problema:** o import mostra só contagens; não há diff, e o modo “mesclar” sobrescreve `settings` com o incoming. Um erro de escolha pode substituir configurações sem aviso.

**Mudança:**

- `POST /api/import/preview`: valida e devolve:
  - Contagens por coleção.
  - Itens novos, atualizados e removidos (por id).
  - Conflitos de settings.
  - Issues de validação.
- UI: seção “O que vai mudar” com diff resumido e escolha de política para settings (“manter atual” / “usar do arquivo”).
- `merge` explícito: incoming vence por id; documentar.
- Backup automático antes de aplicar; botão “Baixar backup atual”.
- Teste de merge com ids conflitantes.

**Aceite:**

- [x] O usuário vê o que será adicionado/alterado/removido antes de confirmar.
- [x] Settings não são sobrescritos sem escolha.
- [x] Import inválido não grava nada.
- [x] Backup é criado e mencionado.

---

### DATA-09 — Rotação de backups e “backup agora”

**Prioridade:** P1 · **Esforço:** M · **Depende de:** DATA-07

**Problema:** existe apenas um `.bak` por arquivo, sobrescrito a cada gravação. Um erro lógico pode corromper o único backup.

**Mudança:**

- Manter `.bak` + `.bak.1` ... `.bak.7` (ou diários) com rotação.
- Botão “Backup agora” no Gerenciar → baixa um bundle ou cria cópia datada.
- Mostrar “último backup: há X” no diagnóstico.
- Nunca apagar o último backup válido.
- Teste de rotação (7 gravações → 7 backups).

**Aceite:**

- [x] Existem pelo menos 3 gerações de backup.
- [x] O backup mais antigo é rotacionado, não o mais novo.
- [x] O usuário consegue baixar um backup manual.
- [x] O diagnóstico mostra a idade.

---

### DATA-10 — Abstração `loadHubWithFallback` no storage

**Prioridade:** P2 · **Esforço:** S · **Depende de:** —

**Problema:** `loadHubFromBackup` só existe na classe concreta, mas o layout usa `getStorage().loadHubFromBackup()`. Se migrar para SQLite/DB, a abstração quebra.

**Mudança:**

- Adicionar `loadHubWithFallback(): Promise<{ hub, error, usingBackup }>` à interface `HubStorage`.
- Implementar em `JsonFileStorage` reaproveitando a lógica atual.
- Layout usa só a interface.
- Teste do fallback.

**Aceite:**

- [x] O layout não conhece `JsonFileStorage`.
- [x] O comportamento de fallback é idêntico.
- [x] A interface documenta o contrato.

---

## 6. Fase 2 — Produtividade e organização (P1)

> Objetivo: transformar o hub de “lista bonita” em ferramenta de trabalho diário: capturar rápido, organizar em massa, encontrar tudo e não se perder.

### ORG-01 — Ações em massa + Desfazer

**Prioridade:** P1 · **Esforço:** L · **Depende de:** DATA-01

**Problema:** só existe “marcar tudo como lido”. Não há multiseleção para mover, taggear, salvar, excluir ou marcar lidos em lote.

**Mudança:**

- Modo de seleção na Biblioteca, no Gerenciar e no Feed:
  - Checkbox por card/linha.
  - Shift+clique para intervalo.
  - “Selecionar todos os visíveis”.
- Barra de ações flutuante: marcar lido/não lido, salvar/remover, mover categoria/grupo, adicionar tag, excluir.
- Confirmação para exclusão; “Desfazer” por 10 s (guardar payload inverso no cliente ou endpoint de undo).
- Para exclusão, considerar soft delete (`deletedAt`) com “Lixeira” por 30 dias (P2 se o esforço crescer).
- Testes de seleção e ações.

**Aceite:**

- [x] Selecionar 20 itens e mover para outra categoria funciona.
- [x] “Desfazer” restaura o estado anterior.
- [x] Teclado: espaço seleciona, Shift+setas estende.
- [x] A seleção não interfere no scroll/masonry.

---

### ORG-02 — Drag & drop com fallback de teclado

**Prioridade:** P1 · **Esforço:** L · **Depende de:** ORG-16 (ordem de fontes), DATA-07 (migração se necessário)

**Problema:** ordenar item/grupo/categoria é só por ↑/↓; fontes não têm ordem; o Acesso rápido não é reordenável.

**Mudança:**

- DnD em itens (dentro do grupo e entre grupos), grupos (dentro da categoria), categorias e fontes.
- Usar HTML5 DnD ou `svelte-dnd-action`; manter ↑/↓ como fallback acessível.
- Normalizar `order` (1..n) após cada movimento, com update transacional.
- No Acesso rápido: `settings.quickAccessOrder: string[]` (ids) ou `pinnedOrder` por item; arrastar para ordenar.
- Feedback visual de “drop target”; cancelar com Esc.
- Testes de reordenação e persistência.

**Aceite:**

- [x] Arrastar um item para outro grupo muda categoria/grupo e ordem.
- [x] Recarregar mantém a ordem.
- [x] Teclado consegue reordenar (↑/↓ ou menu “Mover para”).
- [x] Mobile tem alternativa (menu “Mover para cima/baixo”).

---

### ORG-03 — Tags como filtro de primeira classe

**Prioridade:** P1 · **Esforço:** M · **Depende de:** —

**Problema:** tags existem no modelo e entram na busca, mas não há UI para filtrar por tag, renomear, mesclar ou sugerir.

**Mudança:**

- Chips de tags na Biblioteca e no Gerenciar.
- Filtro `?tag=build` combinável com categoria/tipo.
- Autocomplete de tags existentes no editor.
- Tela “Tags” no Gerenciar: renomear, mesclar, remover de todos.
- Contagem por tag.
- Testes de filtro e rename.

**Aceite:**

- [x] Clicar em "build" mostra só itens com a tag.
- [x] Renomear uma tag atualiza todos os itens.
- [x] Tags duplicadas por caixa/espaço são normalizadas.
- [x] A URL reflete o filtro.

---

### ORG-04 — Importar bookmarks HTML + OPML (import/export)

**Prioridade:** P1 · **Esforço:** L · **Depende de:** DATA-08

**Problema:** o app só importa o próprio JSON. Para adotar em um PC novo ou trazer favoritos do Chrome/Edge e feeds de outro leitor, é tudo manual. Isso é a maior barreira de entrada do nicho.

**Mudança:**

- **Bookmarks HTML (Netscape):** parser de `<DL><DT><H3>` e `<A HREF>`; pastas viram categorias/grupos; dedupe por URL.
- **OPML:** `<outline xmlUrl text>`; pastas viram categorias; cria `feedSources` com defaults (RSS, 60 min, 30 posts); dedupe por URL.
- Preview antes de importar (contagens, duplicados, inválidos).
- Exportar OPML de todas as fontes; exportar bookmarks HTML dos links.
- Fixtures de Chrome, Edge, Feedly e Inoreader.
- Testes de parsing e merge.

**Aceite:**

- [x] Importar um bookmarks.html do Chrome cria categorias/grupos/links.
- [x] Importar um OPML cria fontes e não duplica.
- [x] Exportar OPML reimporta sem perda.
- [x] Itens inválidos são listados, não silenciados.

---

### ORG-05 — Quick add + bookmarklet “salvar aba atual”

**Prioridade:** P1 · **Esforço:** M · **Depende de:** UX-03, SEC-05

**Problema:** adicionar um link exige abrir o Gerenciar, escolher aba, clicar em Adicionar, preencher tudo. Para uma homepage, isso é caro demais.

**Mudança:**

- Rota/modal `/adicionar` com URL, título, categoria, grupo, tags e “fixar”.
- Endpoint `/api/metadata?url=` (safe-fetch, timeout, tamanho) para sugerir título/descrição/favicon; cache local.
- Bookmarklet:
  ```js
  javascript: (() => {
  	const u = encodeURIComponent(location.href),
  		t = encodeURIComponent(document.title);
  	open('http://127.0.0.1:5757/gerenciar?add=link&url=' + u + '&title=' + t, '_blank');
  })();
  ```
- Botão “Copiar bookmarklet” no Gerenciar.
- Atalho `Ctrl+K → Adicionar link`.
- Testes de metadata e fallback quando a página bloqueia.

**Aceite:**

- [x] Salvar a aba atual leva ao formulário preenchido em ≤ 2 cliques.
- [x] Título/descrição são sugeridos quando possível.
- [x] Falha de metadata não impede salvar manualmente.
- [x] O bookmarklet funciona em Chrome/Edge/Firefox.

---

### ORG-06 — Palette de comandos + busca no feed/salvos/notas

**Prioridade:** P1 · **Esforço:** L · **Depende de:** UX-02

**Problema:** a palette atual é uma busca de links/apps/categorias, não uma command palette. Não executa ações nem pesquisa posts/salvos/notas.

**Mudança:**

- Indexar: links, apps, categorias, fontes, posts recentes, salvos, notas e comandos.
- Comandos: “Adicionar link”, “Adicionar fonte”, “Abrir Gerenciar (aba X)”, “Atualizar feed”, “Marcar tudo como lido”, “Exportar”, “Ir para Biblioteca/Favoritos”.
- Prefixos: `>` comandos, `tag:`, `source:`, `is:unread`, `is:saved`.
- Resultados agrupados por tipo, com atalhos.
- Índice memoizado; debounce de 100–150 ms.
- A11y completa (UX-11).
- Testes de busca e comandos.

**Aceite:**

- [x] `Ctrl+K` → “adicionar” mostra o comando e executa.
- [x] Buscar título de post encontra o post.
- [x] `is:unread` filtra.
- [x] A paleta abre em < 50 ms com 500 posts.

---

### ORG-07 — Não lidos por categoria e por fonte

**Prioridade:** P1 · **Esforço:** M · **Depende de:** UX-07

**Problema:** a sidebar mostra “itens · fontes”, não posts não lidos; o usuário não sabe onde está o conteúdo novo.

**Mudança:**

- Calcular `unreadByCategory` e `unreadBySource` a partir de `buildFeedView` + `state.read`.
- Badge de não lidos na sidebar (por categoria) e no aside (por fonte).
- Tooltip: “12 não lidos · 17 itens · 3 fontes”.
- Clicar leva ao feed filtrado.
- Atualizar em tempo real após marcar lido.
- Testes de contagem com fontes desligadas/removidas.

**Aceite:**

- [x] Categoria com 5 não lidos mostra “5”.
- [x] Marcar um post como lido decrementa.
- [x] Fonte desligada não conta.
- [x] A contagem não inclui posts filtrados por regra da fonte.

---

### ORG-08 — “Marcar mais antigos que X como lido”

**Prioridade:** P1 · **Esforço:** S · **Depende de:** UX-09

**Problema:** depois de uma semana sem abrir, o usuário precisa marcar tudo ou conviver com 300 não lidos. Leitores RSS têm “mark older than” como higiene básica.

**Mudança:**

- Menu no feed: “Marcar como lido: mais de 1 dia / 7 dias / 30 dias”.
- Aplicar ao conjunto filtrado (ou a todas as fontes, com escolha).
- Confirmação + Desfazer.
- Endpoint `mark-older-than` ou reutilizar `mark-all-read` com ids calculados no cliente.
- Teste de corte por data.

**Aceite:**

- [x] “Mais de 7 dias” marca só posts com `publishedAt` anterior.
- [x] Posts sem data não são marcados por engano.
- [x] Desfazer restaura.

---

### ORG-09 — Triagem por teclado (j/k/s/m/?)

**Prioridade:** P1 · **Esforço:** M · **Depende de:** ORG-06

**Problema:** só existem Ctrl+K e Esc. Para quem lê 50 posts, o mouse é o gargalo.

**Mudança:**

- Atalhos no feed: `j`/`k` próximo/anterior, `Enter` abrir, `s` salvar, `m` lido, `u` não lido, `r` atualizar, `?` ajuda.
- `g h` início, `g f` feed, `g b` biblioteca, `g m` gerenciar.
- Ignorar atalhos quando o foco está em input/textarea/select.
- Destacar o card ativo e rolar até ele.
- Overlay de ajuda com todos os atalhos.
- Testes de teclado.

**Aceite:**

- [x] `j`/`k` navegam sem abrir o post.
- [x] `s` salva e `m` marca lido.
- [x] `?` abre a ajuda.
- [x] Atalhos não disparam ao digitar na busca.

---

### ORG-10 — Filtros salvos com escopo (categoria/fonte/não lidos)

**Prioridade:** P1 · **Esforço:** M · **Depende de:** ORG-07

**Problema:** filtros salvos são globais e só capturam include/exclude. A visão “não lidos de Jogos” não pode ser salva.

**Mudança:**

- Estender `SavedFilter` com `categoryId?`, `sourceId?`, `unreadOnly?`, `view?`.
- “Salvar visão atual” captura busca + categoria + fonte + não lidos + visualização.
- Deep link aplica tudo.
- Migração default `undefined` (compatível).
- Testes de aplicação combinada.

**Aceite:**

- [x] Salvar “Jogos + não lidos + patch” reaplica a visão.
- [x] Filtros antigos continuam funcionando.
- [x] A contagem do chip respeita o escopo.

---

### ORG-11 — Links quebrados, duplicados e cache de favicons

**Prioridade:** P2 · **Esforço:** L · **Depende de:** SEC-05, ORG-04

**Problema:** não há como saber se um link morreu, se está duplicado ou se o ícone está quebrado. Start pages boas fazem essa higiene.

**Mudança:**

- Verificação manual “Verificar links” + job periódico (semanal) com HEAD/GET limitado, timeout e concorrência.
- Status por item: `ok`, `redirect`, `404`, `timeout`, `erro`.
- Duplicados por URL normalizada (host lower, remover `utm_*`, trailing slash) e por título.
- UI de revisão com “manter um”, “remover duplicados”, “marcar como arquivado”.
- Cache local de favicons em `data/icons` (ou `static` gerado) com fallback de iniciais.
- Testes com fixtures de URLs.

**Aceite:**

- [ ] Verificar 30 links não trava a UI.
- [ ] Links quebrados aparecem com badge.
- [ ] Duplicados são agrupados e resolvíveis.
- [ ] Ícones carregam offline após o primeiro fetch.

---

### ORG-12 — “Testar fonte”/preview antes de salvar

**Prioridade:** P1 · **Esforço:** M · **Depende de:** DATA-03

**Problema:** você só descobre se a fonte funciona depois de salvar e atualizar. O “Detectar” ajuda, mas não mostra o conteúdo.

**Mudança:**

- Botão “Testar” no editor de fonte: faz fetch seguro, parse, mostra os 3 primeiros títulos, contagem e erros.
- Não grava no cache definitivo (ou grava em draft).
- Mostra quantos posts passariam nas regras include/exclude.
- Timeout curto, feedback claro.
- Teste com feed mockado.

**Aceite:**

- [x] Testar uma URL mostra títulos antes de salvar.
- [x] URL inválida mostra erro claro.
- [x] As regras mostram a contagem resultante.
- [x] O teste não altera o cache real.

---

### ORG-13 — Chips de filtro por fonte no feed

**Prioridade:** P1 · **Esforço:** S · **Depende de:** ORG-07

**Problema:** no feed completo só há chips por categoria. Não dá para ver “só o YouTube” ou “só o subreddit”.

**Mudança:**

- Chips de fonte (com contagem de não lidos) abaixo dos de categoria.
- Filtro combinável com categoria e busca.
- URL `?fonte=<id>`.
- Reset visível.
- Teste de combinação.

**Aceite:**

- [x] Clicar em “r/Darktide” mostra só posts dessa fonte.
- [x] Combina com “Não lidos”.
- [x] A URL é compartilhável.

---

### ORG-14 — Página de grupo `/g/[slug]` + “abrir tudo do grupo”

**Prioridade:** P2 · **Esforço:** M · **Depende de:** ORG-02

**Problema:** o grupo existe no modelo e na UI, mas não tem página própria nem ação “abrir tudo” (comum em start pages para um contexto de jogo/projeto).

**Mudança:**

- Rota `/g/[slug]` com links/apps do grupo + feed das fontes do grupo.
- Botão “Abrir tudo” (respeitando bloqueador de pop-up; abrir em sequência com confirmação).
- Link “editar grupo” contextual.
- Testes de rota e filtro.

**Aceite:**

- [ ] `/g/darktide` mostra app, wiki, builds, subreddit e feed.
- [ ] “Abrir tudo” abre os links em novas abas após confirmação.
- [ ] Grupo inexistente retorna 404 amigável.

---

### ORG-15 — Recentes/frequência de uso (local)

**Prioridade:** P2 · **Esforço:** M · **Depende de:** —

**Problema:** o Acesso rápido é fixo por `pinned`; não há “o que eu mais uso” nem “abri recentemente”.

**Mudança:**

- Registrar abertura de item (timestamp, count) em `estado.json` ou `usage.json` (local).
- Seção “Recentes” na home e/ou ordenação “Mais usados” na Biblioteca.
- Não enviar nada para fora.
- Opção de limpar histórico.
- Testes de contagem.

**Aceite:**

- [ ] Abrir um link o coloca em Recentes.
- [ ] “Mais usados” ordena por contagem.
- [ ] O usuário pode limpar o histórico.
- [ ] Nada sai da máquina.

---

### ORG-16 — Ordem de fontes (campo `order` + migração)

**Prioridade:** P1 · **Esforço:** S · **Depende de:** DATA-07

**Problema:** `FeedSource` não tem `order`; a lista segue a ordem de inserção. Não dá para colocar as fontes importantes no topo.

**Mudança:**

- Adicionar `order?: number` ao tipo/schema; default 0.
- Migração v1→v2 preenche por índice.
- Ordenar na UI (home, feed, gerenciar).
- Ações `move-source` e DnD (ORG-02).
- Testes de ordenação.

**Aceite:**

- [x] Fontes aparecem na ordem definida.
- [x] Reordenar persiste.
- [x] Dados antigos migram sem erro.

---

### ORG-17 — Customização do Acesso rápido

**Prioridade:** P1 · **Esforço:** M · **Depende de:** ORG-02

**Problema:** o Acesso rápido mostra até 6 itens fixados, ordenados por `item.order` (que é por categoria/grupo), então a ordem entre categorias é imprevisível. Não dá para fixar/desafixar nem reordenar sem abrir o editor de cada item.

**Mudança:**

- Ação rápida “Fixar/Desafixar” no card (hover/menu) da Biblioteca e da categoria.
- `settings.quickAccessOrder: string[]` ou `pinnedOrder` por item; migração default [].
- DnD no Acesso rápido; “Editar atalhos” abre modo de edição.
- Limite configurável (6/8/10).
- Teste de ordem e persistência.

**Aceite:**

- [x] Fixar um item o coloca no Acesso rápido.
- [x] Arrastar reordena e persiste.
- [x] O limite é respeitado.
- [x] Itens desafixados saem imediatamente.

---

### ORG-18 — Notas em storage próprio + export

**Prioridade:** P1 · **Esforço:** M · **Depende de:** DATA-07

**Problema:** a “Nota rápida” vive no `localStorage`; não entra no export, não sincroniza e some ao limpar o navegador. É uma das funções mais úteis da home, mas é a menos confiável.

**Mudança:**

- `data/notes.json` com `{ version, notes: [{ id, text, createdAt, updatedAt, pinned }] }`.
- Zod + escrita atômica + `.bak` + lock.
- Debounce de 500 ms; indicador “salvo”.
- Incluir no export/import (campo opcional `notes`).
- Home: uma nota rápida ou lista; “Nova nota”.
- Busca na palette.
- Teste de persistência e export.

**Aceite:**

- [x] A nota sobrevive a limpar o navegador e trocar de PC (via export).
- [x] O export inclui as notas.
- [x] O texto é salvo com debounce e feedback.
- [x] Notas não vazam para o Git.

---

### ORG-19 — Primeiro uso: seed/assistente de configuração

**Prioridade:** P2 · **Esforço:** M · **Depende de:** ORG-04

**Problema:** o primeiro uso exige copiar `hub.example.json` manualmente. Para um app pessoal, isso é uma barreira.

**Mudança:**

- Detectar ausência de `hub.json` e oferecer:
  - “Começar com exemplo” (copia o seed).
  - “Importar meus bookmarks/OPML”.
  - “Começar vazio”.
- Explicar `HUB_DATA_DIR` e onde os dados ficam.
- Script `npm run setup` para criar `.env` e `hub.json`.
- Teste do fluxo de primeira execução.

**Aceite:**

- [x] Sem `hub.json`, o app oferece um caminho claro.
- [x] “Começar com exemplo” cria o arquivo e recarrega.
- [x] O usuário entende onde os dados estão.

---

## 7. Fase 3 — Leitura e salvos (P2)

> Objetivo: fazer o “Salvar para depois” valer o nome: ler sem sair, marcar trechos, guardar uma cópia e encontrar depois.

### READ-01 — Reader mode + texto completo

**Prioridade:** P2 · **Esforço:** L · **Depende de:** SEC-02, SEC-05

**Problema:** hoje “Abrir” sai do hub. Muitos feeds publicam só um resumo; o usuário cai em site com paywall, cookies e layout ruim. Reader mode é a funcionalidade que mais falta em read-later.

**Mudança:**

- Extração server-side com `@mozilla/readability` + `linkedom`/`jsdom` (ou `cheerio` se o peso importar).
- Sanitização do HTML extraído (`sanitize-html` ou similar); renderizar como texto/HTML seguro.
- Endpoint `GET /api/read?id=<itemId>` com cache em `data/reading/<id>.json`.
- Toggle por fonte “buscar texto completo” (default off).
- UI: modal ou rota `/ler/[id]` com tipografia confortável, largura de leitura, tema escuro, botão “abrir original”.
- Fallback para o resumo se a extração falhar.
- Timeout, limite de tamanho e `safe-fetch`.
- Testes com fixtures de HTML (notícia, blog, YouTube, paywall).
- Aviso de respeito a paywall/direitos; cache local apenas.

**Aceite:**

- [x] Salvar um post e abrir o reader mostra o texto principal.
- [x] Extração falha → fallback claro para o site.
- [x] HTML perigoso é sanitizado (teste com `<script>`).
- [x] Cache local evita refetch.
- [x] Funciona offline para itens já extraídos.

---

### READ-02 — Highlights, notas e cores por item salvo

**Prioridade:** P2 · **Esforço:** L · **Depende de:** READ-01

**Problema:** não há como marcar um trecho, anotar por que salvou ou revisar depois. É o que diferencia “lista de links” de “biblioteca de leitura”.

**Mudança:**

- Seleção de texto no reader → toolbar “Destacar” (cores) + “Anotar”.
- Modelo `Highlight { id, itemId, quote, note?, color, createdAt, updatedAt }` em `data/reading.json` ou no estado.
- Lista de highlights no item salvo e em uma tela “Highlights”.
- Busca por highlight/nota.
- Exportar Markdown/Obsidian (READ-04).
- Renderizar quote/nota como texto (sem HTML).
- Testes de criação, edição, remoção e busca.

**Aceite:**

- [x] Selecionar e destacar persiste após reload.
- [x] Nota é editável e pesquisável.
- [x] Cores são acessíveis (não dependem só de cor).
- [x] Exportar gera Markdown legível (entregue na `v0.31.0`; destaques entram no export Markdown e no JSON do hub).

---

### READ-03 — Arquivo/offline do item salvo

**Prioridade:** P2 · **Esforço:** L · **Depende de:** READ-01

**Problema:** se o site cair, o snapshot atual guarda só título/resumo/thumbnail. O conteúdo se perde (link rot).

**Mudança:**

- Ao salvar (ou sob demanda), guardar:
  - Texto extraído (reader).
  - HTML bruto opcional em `data/archive/<id>.html` (com assets? começar sem).
  - Thumbnail local opcional.
- Tela “Arquivados” / badge “arquivado”.
- Política de retenção e tamanho; exportar arquivo.
- Verificação de link morto (ORG-11) usa o arquivo como fallback.
- Testes de arquivamento e leitura offline.

**Aceite:**

- [x] Item salvo continua legível se a URL original retornar 404.
- [x] O arquivo é local e não sai da máquina.
- [x] O usuário vê quanto espaço está usando.
- [x] Pode apagar o arquivo mantendo o snapshot.

---

### READ-04 — Exportar salvos/highlights em Markdown/Obsidian

**Prioridade:** P2 · **Esforço:** M · **Depende de:** READ-02

**Problema:** o que está salvo fica preso no app; usuários de Obsidian/Notion querem levar highlights e notas.

**Mudança:**

- Exportar um `.zip` ou `.md` por item com frontmatter (título, URL, fonte, data, tags) + highlights/notas.
- Formato compatível com Obsidian (pastas por categoria, nomes seguros).
- Opção “copiar Markdown” por item.
- Teste de geração de arquivo.

**Aceite:**

- [x] Exportar 10 salvos gera 10 arquivos Markdown válidos.
- [x] Frontmatter contém URL/data/tags.
- [x] Nomes de arquivo não colidem.
- [x] Funciona sem dependências novas pesadas.

---

### READ-05 — Busca full-text nos salvos + estatísticas de leitura

**Prioridade:** P2 · **Esforço:** M · **Depende de:** READ-01/READ-03

**Problema:** a busca atual cobre título/resumo do cache; não cobre o texto extraído, highlights ou notas.

**Mudança:**

- Índice local (Fuse ou MiniSearch) sobre texto extraído, highlights e notas.
- Busca em `/favoritos` com “buscar no conteúdo”.
- Estatísticas: salvos, lidos, arquivados, highlights, tempo estimado de leitura.
- Testes de indexação e busca.

**Aceite:**

- [x] Buscar uma frase do conteúdo encontra o salvo (`v0.32.0`).
- [x] A busca não trava com 500 itens (índice truncado + cache + debounce).
- [ ] As estatísticas são calculadas localmente (fatia 2, `v0.32.1`).

---

### READ-06 — Text-to-speech/podcast (opcional)

**Prioridade:** P3 · **Esforço:** L · **Depende de:** READ-01

**Problema:** alguns usuários consomem conteúdo ouvindo.

**Mudança:**

- Web Speech API local (sem custo/privacidade) para ler o texto extraído.
- Controles play/pause/velocidade.
- Não baixar áudio nem usar serviço externo por padrão.
- Teste manual em Chrome/Edge.

**Aceite:**

- [ ] “Ouvir” lê o texto no navegador.
- [ ] Funciona offline.
- [ ] Pode parar e ajustar velocidade.

---

## 8. Fase 4 — Plataforma e polimento (P2/P3)

> Objetivo: fazer o hub parecer e se comportar como um app de verdade no Windows, com privacidade, backup, diagnóstico e performance.

### PLAT-01 — PWA/manifest/service worker/offline shell

**Prioridade:** P1 · **Esforço:** M · **Depende de:** UX-15

**Problema:** não é instalável, não tem manifest, não abre offline. Para ser “homepage”, precisa estar sempre à mão.

**Mudança:**

- `static/manifest.webmanifest` com nome, ícones 192/512, `display: standalone`, `start_url`, `theme_color`, `background_color`.
- Service worker: cache do app shell/estáticos; página “Servidor offline” quando as APIs não respondem.
- Cache opcional de leitura (IndexedDB) para últimos posts/salvos — só se valer o esforço.
- Botão “Instalar app” quando disponível.
- Teste no Edge/Chrome (instalação e offline shell).
- Documentar que os dados continuam no servidor local.

**Aceite:**

- [x] O app instala como PWA.
- [x] Abre offline com o shell e uma mensagem clara.
- [x] Ícones corretos em 192/512.
- [x] Nenhum dado sensível no cache do service worker.

---

### PLAT-02 — Autostart no Windows + script de setup

**Prioridade:** P1 · **Esforço:** M · **Depende de:** —

**Problema:** o app só existe se você rodar `npm start`. Se esquecer, a homepage não abre. Não há atalho, tray ou inicialização automática.

**Mudança:**

- `scripts/start-ihub.vbs` ou `start.bat` que inicia o Node sem janela.
- Atalho na pasta Startup do Windows (`shell:startup`).
- Alternativa: Task Scheduler no logon + `nssm`/`pm2` (documentar).
- Script `npm run setup` para `.env`, `hub.json` e atalho.
- Checagem de porta ocupada e mensagem amigável.
- Teste em um usuário Windows limpo (manual).

**Aceite:**

- [x] Ao logar no Windows, o hub está acessível em `127.0.0.1:5757` (validado pelo dono em 12/11/2026).
- [x] Fechar a janela do terminal não derruba o servidor (VBS oculto; validado pelo dono em 12/11/2026).
- [x] O usuário consegue desativar o autostart.
- [x] Há instruções no README.

---

### PLAT-03 — Fontes/ícones locais, `no-referrer`, proxy de imagem

**Prioridade:** P2 · **Esforço:** L · **Depende de:** SEC-02

**Problema:** Google Fonts, DuckDuckGo e Simple Icons CDN geram dependência de rede e vazamento de privacidade; thumbnails externas carregam direto do site de origem.

**Mudança:**

- Baixar Inter/Space Grotesk em `static/fonts` e usar `@font-face`; remover links do Google.
- Ícones: usar `simple-icons` local para apps + cache de favicon em `data/icons` (fetch seguro) ou mapa local; fallback de iniciais.
- `referrerpolicy="no-referrer"` em todas as imagens externas.
- Proxy de imagem opcional `/api/image?url=` com `safe-fetch`, allowlist, limite de tamanho, content-type e cache; nunca proxyar conteúdo arbitrário sem validação.
- Teste offline: fontes e ícones continuam.
- Documentar a política de privacidade.

**Aceite:**

- [ ] O app abre e fica bonito sem internet (fontes e ícones cacheados).
- [ ] Nenhuma requisição a Google Fonts/DuckDuckGo/Simple Icons por padrão.
- [ ] Thumbnails não enviam referrer.
- [ ] O proxy bloqueia IP privado e conteúdo inválido.

---

### PLAT-04 — Detecção de conflito de sincronização + backup rotativo

**Prioridade:** P1 · **Esforço:** L · **Depende de:** DATA-07/DATA-09

**Problema:** a sincronização por pasta (Drive/OneDrive) usa “última gravação vence”; arquivos de conflito do Drive podem aparecer e o usuário não sabe qual é o bom. Em dois PCs, dá para perder alterações.

**Mudança:**

- Adicionar `instanceId` e `revision`/`updatedAt` ao hub/estado.
- Ao carregar, comparar com o último visto; se mudou fora do processo, mostrar banner “Dados alterados por outro PC; recarregar / mesclar”.
- Arquivo de lock (`data/.lock`) com PID/hostname e stale timeout; ou lock via `open(..., 'wx')`.
- Detectar arquivos `* (conflito)*.json` / `*-cópia.json` e oferecer “Comparar/Importar”.
- Backup rotativo (DATA-09) antes de qualquer merge.
- Documentar o fluxo de dois PCs.
- Testes de revisão e conflito.

**Aceite:**

- [ ] Alterar o hub externamente mostra aviso em vez de sobrescrever silenciosamente.
- [ ] Conflito do OneDrive é detectado e resolvível.
- [ ] O lock não trava para sempre se o processo morrer.
- [ ] O fluxo de dois PCs está documentado.

---

### PLAT-05 — API token opcional + `/api/health` + diagnóstico

**Prioridade:** P2 · **Esforço:** M · **Depende de:** SEC-02

**Problema:** a API é aberta para qualquer processo local; não há health check nem diagnóstico de dados. Para automações/bookmarklet, um token ajuda; para suporte, um health ajuda.

**Mudança:**

- `HUB_API_TOKEN` opcional: se definido, exigir `Authorization: Bearer` em POST; GETs de leitura podem continuar abertos ou também exigir.
- `/api/health` com versão, uptime, `dataDir`, writable, contagens, último refresh, erros, tamanho dos arquivos, idade do backup.
- Aba “Diagnóstico” no Gerenciar: mostra tudo, “testar escrita”, “abrir pasta de dados”, “baixar backup”.
- Documentar endpoints no README.
- Teste de auth e health.

**Aceite:**

- [x] Com token definido, POST sem token retorna 401.
- [x] `/api/health` responde sem vazar segredos.
- [x] O diagnóstico mostra a saúde dos dados.
- [x] Funciona em `127.0.0.1` por padrão.

---

### PLAT-06 — Widgets e layout configurável da home

**Prioridade:** P2 · **Esforço:** L · **Depende de:** ORG-17

**Problema:** a home é fixa (Acesso rápido, Resumo, Ações, 5 posts, aside). Usuários de start pages esperam escolher o que fica visível e em que ordem.

**Mudança:**

- `settings.home.layout: { widgets: [{ type, enabled, order }] }`.
- Widgets: quickAccess, summary, actions, recentSaved, sources, filters, note, clock, tasks.
- Opcionais depois: weather (Open-Meteo, localização opt-in), calendar (ICS local/proxy).
- Modo “edição da home” com arrastar/recolher.
- Presets: “Mínimo”, “Leitura”, “Trabalho”.
- Teste de persistência e responsividade.

**Aceite:**

- [ ] Reordenar/ocultar widgets persiste.
- [ ] A home fica utilizável em 375 px.
- [ ] Widgets opcionais podem ser desligados.
- [ ] Nenhum widget externo quebra a privacidade por padrão.

---

### PLAT-07 — Notificações e badge de não lidos no título/favicon

**Prioridade:** P2 · **Esforço:** M · **Depende de:** ORG-07

**Problema:** o contador de não lidos só aparece na sidebar; se a aba está em segundo plano, você não percebe novidades.

**Mudança:**

- `document.title = "(3) Meu Hub"` com o total de não lidos.
- Badge no favicon via canvas (opcional).
- Notification API opt-in quando chegam novos posts após refresh (somente com permissão).
- Respeitar “não perturbe”; botão para desativar.
- Teste de título e permissão.

**Aceite:**

- [x] O título reflete o total de não lidos.
- [x] A notificação só aparece com permissão.
- [x] O usuário pode desligar.
- [x] Não notifica posts já lidos.

---

### PLAT-08 — Navegação mobile, densidade, tema e contraste

**Prioridade:** P1 · **Esforço:** L · **Depende de:** UX-14

**Problema:** abaixo de 900 px a sidebar vira um bloco alto com todas as categorias; a home empilha tudo; 11–12 px e opacidade pioram a leitura. Não há densidade nem ajuste de fonte.

**Mudança:**

- Mobile: top bar fixa com menu (drawer) para categorias; navegação primária em bottom bar ou menu; esconder footer redundante.
- Home: painéis colapsáveis; “Resumo” no topo; aside vira seção inferior.
- Configurações: densidade (confortável/compacta), tamanho de fonte (13/14/15), contraste alto.
- Tema: manter dark como padrão; se adicionar claro, usar os mesmos tokens.
- Testar 320/375/414/768/1024/1440.
- Axe + navegação por teclado.

**Aceite:**

- [x] Em 375 px, o menu não ocupa a primeira tela inteira.
- [x] Nenhum texto essencial abaixo de 12 px.
- [x] Densidade e fonte persistem.
- [x] Contraste alto passa em axe.

---

### PLAT-09 — CI + testes de componente/e2e + axe

**Prioridade:** P1 · **Esforço:** L · **Depende de:** —

**Problema:** 159 testes unitários excelentes, mas nenhum teste de API, componente ou fluxo real. Regressões em palette, editor, import e refresh passam despercebidas.

**Mudança:**

- GitHub Actions: `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run build`.
- Playwright para 8 fluxos: adicionar link, importar, buscar, ler/salvar, marcar tudo, gerenciar fonte, palette, mobile.
- `@axe-core/playwright` nas páginas principais.
- Testes de API chamando handlers com `Request` mockado.
- Cobertura mínima para módulos críticos (schema, storage, parser, import).
- Rodar em PR e em `main`.

**Aceite:**

- [x] CI fica verde em PR (primeira execução: run 43132331993, ambos os jobs verdes).
- [ ] E2E cobre os fluxos críticos (6 de 8: adicionar link, salvar post, marcar tudo, palette, mobile e nota; faltam importar bookmarks e testar fonte no Gerenciar).
- [x] Axe não encontra violações críticas.
- [x] O build de produção é testado.

---

### PLAT-10 — Refatorar CSS em tokens/arquivos + remover cores fixas

**Prioridade:** P2 · **Esforço:** M · **Depende de:** UX-14

**Problema:** 2.211 linhas em um arquivo, cores hardcoded e estilos inline repetidos. A consistência vai degradar conforme o app cresce.

**Mudança:**

- Dividir em `styles/tokens.css`, `base.css`, `layout.css`, `components.css`, `pages.css` (ou usar `<style>` scoped nos componentes).
- Substituir `#202632`, `#323946`, `#3f6b55`, `rgba(138,164,255,...)` por tokens.
- Remover `style="font-size: ..."` avulsos; criar classes utilitárias.
- Documentar tokens no README.
- Teste visual das páginas.

**Aceite:**

- [x] Trocar o accent atualiza todos os elementos.
- [x] Nenhuma cor de marca hardcoded fora de tokens.
- [x] Nenhum estilo inline de tipografia.
- [x] Build CSS não cresce.

---

### PLAT-11 — Modelo de erro de storage + padronizar nomes

**Prioridade:** P3 · **Esforço:** M · **Depende de:** —

**Problema:** `HubValidationError` é usado para “arquivo não encontrado”; `estado.json` mistura idioma; a abstração vaza. Pequenas dívidas que confundem manutenção.

**Mudança:**

- `StorageError` com `code` (`NOT_FOUND`, `INVALID_JSON`, `VALIDATION`, `LOCK_TIMEOUT`, `IO`), `path`, `cause`.
- `HubValidationError` só para schema.
- Mapear erros para mensagens de UI.
- Se renomear `estado.json` → `state.json`, ler ambos por 1 versão e migrar; documentar.
- Atualizar testes.

**Aceite:**

- [x] Erros de storage têm código e mensagem clara.
- [x] O app não usa validação para “não encontrado”.
- [x] Compatibilidade com arquivos antigos.

---

### PLAT-12 — Performance: memoização, virtualização e critério para SQLite

**Prioridade:** P1 · **Esforço:** L · **Depende de:** ORG-06

**Problema:** a arquitetura é confortável para 51 posts, mas não foi medida em 500/1.000. Cada ação chama `invalidateAll` e re-renderiza; a busca reconstrói o índice; o masonry reposiciona a cada imagem; o feed filtra tudo no cliente.

**Mudança:**

- Medir baseline: tempo de render com 100/500/1.000 posts, tempo de busca, tempo de refresh com 10 fontes.
- Memoizar `buildFeedView`, `buildSavedView`, contagens e índice de busca por `hub`/`feed`/`state`.
- Debounce de busca (120 ms) e limite de resultados.
- Virtualizar lista quando > 200 cards (ou paginação server-side).
- Evitar `invalidateAll` em read/save: atualização otimista + patch local; invalidar só quando necessário.
- Masonry: throttle de `ResizeObserver`, evitar reflow por imagem (aspect ratio fixo/medido antes).
- Critério objetivo para SQLite: > 5.000 posts, > 500 itens, busca full-text, highlights/arquivo ou múltiplos processos. Até lá, JSON + lock basta.
- Orçamento: interação < 100 ms, busca < 150 ms, refresh 10 fontes < 30 s.
- Teste de performance com fixtures.

**Aceite:**

- [ ] 1.000 posts renderizam sem travar (ou com paginação).
- [ ] Buscar não bloqueia a digitação.
- [ ] Read/save não recarregam a página inteira.
- [ ] O critério de migração para SQLite está documentado.

---

## 9. Plano de testes e qualidade

### 9.1 Unitários (já existe base; ampliar)

- `parse.test.ts`: RSS/Atom, entidades, `dc:date`, Atom `rel=alternate`, imagens `data-src`, YouTube, Reddit, **URL `javascript:`/`data:`**.
- `schema.test.ts`: referências, duplicados, **state/cache schemas**, migrações.
- `json-file.test.ts`: escrita atômica, backup, **concorrência**, **rename com erro**, poda.
- `filter.test.ts`: acentos, any/all, exclude, highlight.
- `view.test.ts`: cache órfão, fonte desligada, snapshot, **URL inválida**.
- `search.test.ts`: feed na palette, índice memoizado, operadores.
- `import.test.ts`: bookmarks HTML, OPML, merge, diff, estado inválido.
- `refresh.test.ts`: concorrência, timeout, redirect privado, fonte desabilitada, cache stale.

### 9.2 Integração (novo)

- Chamar handlers de API com `Request` mockado e storage temporário (`HUB_DATA_DIR` em temp dir).
- Casos:
  - POST `/api/hub` add/update/delete + validação.
  - POST `/api/state` read/save/unsave/mark-all + snapshot inválido.
  - POST `/api/import` replace/merge/preview + estado inválido.
  - POST `/api/refresh` concorrente + progresso.
  - Headers de segurança.
  - Limite de body (413).
  - CSRF/Host/Origin.

### 9.3 E2E (Playwright, novo)

1. Adicionar link pela Biblioteca → aparece na categoria certa.
2. Adicionar fonte → testar → atualizar → posts aparecem.
3. Ctrl+K → buscar post → abrir.
4. Salvar post → Favoritos → buscar no resumo → desalvar.
5. Marcar tudo como lido → desfazer.
6. Importar bookmarks HTML → preview → confirmar.
7. Exportar → importar em ambiente limpo → dados iguais.
8. Mobile 375 px: navegar, abrir menu, adicionar link.

### 9.4 Acessibilidade

- `axe-core` em `/`, `/feed`, `/favoritos`, `/biblioteca`, `/gerenciar`, `/c/[slug]`.
- Navegação só por teclado: skip link, palette, editor, tabs, DnD (fallback), switch.
- Leitor de tela: palette, dialog, switch, toast.
- Contraste: todos os textos normais ≥ 4,5:1; grandes ≥ 3:1.
- Foco: visível, não preso, restaurado após fechar modal.
- Movimento: `prefers-reduced-motion` já respeitado; manter.

### 9.5 Segurança

- [x] URL de feed/snapshot só `http(s)`.
- [x] CSP enforced sem erros.
- [x] Headers completos.
- [x] Body limits.
- [x] SSRF no refresh.
- [x] Sem `javascript:`/`data:` em href/src.
- [x] Sem command execution.
- [x] Host/Origin allowlist.
- [x] Sem segredos no Git.
- [x] `npm audit --omit=dev` limpo.
- [x] Token opcional se expor na LAN (`HUB_API_TOKEN` + Bearer desde v0.25.0).

### 9.6 Manual (checklist por release)

> Verificado por testes/E2E + servidor local em 12/11/2026 (v0.28.0). Os itens ainda desmarcados estão no checklist de validação manual em [`docs/validacao-v0.28.md`](docs/validacao-v0.28.md).

- [x] Abrir com `hub.json` válido, inválido e ausente.
- [x] Fonte quebrada não derruba as outras.
- [ ] Refresh com 1, 4 e 10 fontes.
  - Parcial em 12/11/2026: refresh real de 2 fontes ativas (Reddit e YouTube) sem erro; cenário de 1 e 10 fontes não executado.
- [x] Editar categoria/grupo/fonte e recarregar.
  - Validado pelo dono em 12/11/2026 (edição do filtro da fonte r/Darktide refletiu no feed).
- [ ] Importar/substituir/mesclar.
  - Parcial em 12/11/2026: `replace` coberto por automação (export → import, notas preservadas); `merge`/preview na UI não executados nesta rodada.
- [x] Exportar e reimportar.
- [x] Mobile 375 e desktop 1440.
  - Validado pelo dono em 12/11/2026.
- [x] Teclado em todas as telas.
  - Validado pelo dono em 12/11/2026.
- [x] Tema com accent claro/escuro.
  - Validado pelo dono em 12/11/2026.
- [x] Reiniciar o servidor e conferir dados.

---

## 10. Dados, migração e rollback

### 10.1 Ordem segura para qualquer mudança de schema

1. **Backup:** exportar bundle + copiar `data/` para uma pasta datada.
2. **Fixture:** criar um arquivo v1 real (anonimizado) para teste.
3. **Migração pura:** `migrate(raw)` sem I/O, testada.
4. **Dry-run:** validar antes/depois; comparar contagens.
5. **Escrita atômica:** gravar novo arquivo + `.bak` rotativo.
6. **Verificação:** abrir o app e checar as telas críticas.
7. **Rollback:** restaurar o backup se qualquer etapa falhar.

### 10.2 Compatibilidade

- Ler sempre a versão anterior por pelo menos uma release.
- Nunca remover campos sem migração.
- Defaults no Zod para campos novos.
- Se renomear arquivo (`estado.json` → `state.json`), ler o antigo e migrar; manter por 1 versão.

### 10.3 O que entra na v2 (proposta)

- `FeedSource.order`.
- `settings.quickAccessOrder`.
- `SavedFilter.categoryId/sourceId/unreadOnly/view`.
- `instanceId`, `revision`, `updatedAt` (sync).
- `HubState.lastPrunedAt`.
- `notes.json` (fora do hub, mas no export).
- `reading.json` / `highlights` (fase 3).

---

## 11. Riscos e mitigação

| Risco                                        | Probabilidade | Impacto | Mitigação                                                   |
| -------------------------------------------- | ------------- | ------- | ----------------------------------------------------------- |
| Escopo crescer e nada terminar               | Alta          | Alto    | MoSCoW; P0 primeiro; timebox; uma fase por vez              |
| Migração corromper dados                     | Média         | Crítico | Backup, dry-run, fixture, rollback, versão                  |
| CSP quebrar o app                            | Média         | Alto    | Report-Only primeiro; nonce/hash; teste em todas as páginas |
| Reader mode com HTML perigoso                | Média         | Crítico | Sanitização, CSP, testes com `<script>`, renderizar texto   |
| Import de bookmarks/OPML com casos estranhos | Alta          | Médio   | Fixtures reais, preview, dedupe, validação                  |
| DnD quebrar acessibilidade                   | Média         | Alto    | Fallback de teclado + menu “Mover para”                     |
| `rename` falhar no OneDrive                  | Alta          | Alto    | Retry/backoff, fallback, detecção de conflito               |
| Refresh lento/rate limit                     | Alta          | Médio   | Concorrência limitada, backoff, status por fonte            |
| Performance degradar com 1.000 posts         | Média         | Alto    | Baseline, memoização, virtualização, critério SQLite        |
| Dependência nova pesada (readability/jsdom)  | Média         | Médio   | Medir bundle; alternativa `cheerio`; lazy load              |
| Expor na LAN sem auth                        | Baixa         | Crítico | Manter 127.0.0.1; token opcional; documentar                |
| Perder foco em polish e não lançar           | Alta          | Alto    | Cada fase entrega valor sozinha; releases incrementais      |

---

## 12. Cronograma sugerido

> Assumindo uma pessoa, meio período. Ajuste conforme sua disponibilidade.

| Sprint | Foco                 | Entregáveis                                                               | Duração    |
| ------ | -------------------- | ------------------------------------------------------------------------- | ---------- |
| **0**  | Preparação           | Branch, backup, baseline de performance, CI esqueleto, decisões pendentes | 1 dia      |
| **1**  | Fase 0               | UX-01 a UX-16; release “uso diário sem atrito”                            | 4–5 dias   |
| **2**  | Fase 1 (segurança)   | SEC-01 a SEC-05; CSP, URL allowlist, state/cache Zod                      | 4–5 dias   |
| **3**  | Fase 1 (dados)       | DATA-01 a DATA-10; lock, refresh concorrente, migrações, backup           | 6–8 dias   |
| **4**  | Fase 2 (organização) | ORG-01 a ORG-07; bulk, DnD, import, quick add, palette                    | 8–10 dias  |
| **5**  | Fase 2 (resto)       | ORG-08 a ORG-19; unread, teclado, tags, grupos, notas                     | 6–8 dias   |
| **6**  | Fase 3               | READ-01 a READ-05; reader, highlights, archive, export                    | 10–15 dias |
| **7**  | Fase 4               | PLAT-01, 02, 04, 08, 09, 12; PWA, autostart, mobile, CI, performance      | 8–10 dias  |
| **8**  | Polimento            | PLAT-03, 05, 06, 07, 10, 11; opcionais e dívidas                          | 5–8 dias   |

**Total estimado:** 50–70 dias úteis (10–14 semanas em meio período). O P0 + P1 (sprints 1–5) já entrega a maior parte do valor em ~4–6 semanas.

**Regra de release:** cada sprint termina com `npm test`, `check`, `lint`, backup, changelog curto no HANDOFF e uma tag (`v0.x.0`).

---

## 13. Métricas de sucesso

| Área                           | Baseline                   | Meta após P0+P1                       | Meta após P2+P3                       |
| ------------------------------ | -------------------------- | ------------------------------------- | ------------------------------------- |
| Adicionar link                 | ~6+ cliques, vários campos | ≤ 3 cliques, categoria pré-preenchida | ≤ 2 cliques via bookmarklet/quick add |
| Buscar post do feed            | Não encontra               | Encontra pela palette                 | Busca full-text em salvos/highlights  |
| Título do card                 | Não abre em 2 visões       | Abre nas 3                            | —                                     |
| Perda de dados em concorrência | Possível                   | 0 no teste de 10 updates              | 0 com dois processos (lock/revisão)   |
| Estado/cache inválido          | Pode derrubar              | Aviso + fallback                      | Migração automática                   |
| URL maliciosa de feed          | Aceita                     | Bloqueada + CSP                       | Sanitização no reader                 |
| Fontes com erro                | Conta desligadas           | Só ativas                             | Histórico/health por fonte            |
| Refresh 10 fontes              | Sequencial, lento          | Concorrente + progresso               | Job em background                     |
| Testes                         | 159                        | ≥ 200 + integração                    | + 8 E2E + axe                         |
| Axe                            | Não medido                 | 0 violações críticas                  | 0 sérias                              |
| Mobile 375                     | Sidebar alta               | Menu/drawer usável                    | Densidade/tema                        |
| App instalável/offline         | Não                        | PWA shell                             | Offline de leitura                    |
| Backup                         | 1 `.bak`                   | 7 gerações + manual                   | Sync com conflito                     |
| Performance 1.000 posts        | Não medida                 | < 100 ms/interação                    | Virtualização/paginação               |

---

## 14. Decisões pendentes (precisam do dono)

1. **Busca:** incluir posts na palette (recomendado) ou apenas corrigir o texto e focar o filtro do feed?
2. **Terminologia:** “Salvos” ou “Favoritos”? “Links” ou “Sites”?
3. **Notas:** `notes.json` separado (recomendado) ou dentro do `hub.json`?
4. **Reader mode:** usar `@mozilla/readability` + `linkedom` (recomendado) ou uma extração mais simples?
5. **Sync:** continuar só pasta + detecção de conflito, ou partir para um serviço?
6. **Autostart:** VBS na pasta Startup (simples) ou Task Scheduler/serviço (robusto)?
7. **LAN/remoto:** manter só `127.0.0.1` ou habilitar token e acesso na rede?
8. **Tema:** manter só dark ou adicionar claro?
9. **IA:** nunca, ou resumo local/opcional com modelo local?
10. **Retenção/backup:** quantos dias de lidos, quantas gerações de backup, onde guardar?
11. **SQLite:** migrar agora ou só quando bater o critério (recomendado: só no critério)?
12. **Escopo do “read later”:** só metadados + highlights ou arquivo completo da página?

---

## 15. Não objetivos (agora)

- Multiusuário, login, permissões.
- Colaboração, páginas públicas, times.
- Nuvem/hospedagem online.
- App mobile nativo.
- Tema claro (a menos que solicitado).
- Extensão de navegador completa (bookmarklet primeiro).
- Execução de comandos do PC pela interface.
- IA na nuvem enviando conteúdo pessoal.
- Integrações pagas (Feedly, Readwise etc.).

---

## 16. Referências

- **start.me — Features:** importar favoritos, drag & drop, links quebrados/duplicados, notas, tarefas, RSS, widgets, analytics. <https://start.me/features>
- **start.me — About/Features:** importação de navegador/arquivo, organização visual, widgets. <https://about.start.me/features>
- **Raindrop.io:** coleções/tags, highlights, full-text, arquivo web, múltiplas visões, batch, ordenação manual, import/export. <https://raindrop.io/>
- **Raindrop.io vs start.me (ToolGPA, 2026):** full-text, archive, highlights, batch, import/export. <https://toolgpa.com/compare/raindrop-io-vs-start-me>
- **Inoreader — Features:** filtros, pastas/tags, full content, offline, anotações, busca, image proxy, regras, YouTube RSS. <https://www.inoreader.com/features/>
- **The 2026 self-hosted RSS pipeline:** Miniflux, fulltext, regras, dedup, OPML, clientes mobile. <https://www.bigiron.cc/guides/the-2026-self-hosted-rss-pipeline-feeds-filters-and-fulltext>
- **Wallabag/Readeck/Karakeep/Linkwarden:** reader view, highlights, arquivo, import Pocket, offline, full-text. <https://selfhostpicks.com/self-hosted-alternative-to-pocket/>
- **Karakeep:** bookmarks + notas + imagens/PDF, full-text/semantic search, auto-tag, archive, import, API. <https://github.com/karakeep-app/karakeep>

---

## Apêndice A — Mapa de arquivos e responsabilidades

| Arquivo                                    | Responsabilidade                   | Tarefas relacionadas                        |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------- |
| `src/lib/types.ts`                         | Tipos do domínio                   | ORG-16, DATA-07, READ-02                    |
| `src/lib/schema.ts`                        | Zod do hub + (novo) state/cache    | SEC-01, SEC-03, DATA-07                     |
| `src/lib/hub-edit.ts`                      | Funções puras de edição            | UX-06, ORG-02, ORG-16                       |
| `src/lib/hub-actions.ts`                   | Dispatch de ações da API           | UX-03, ORG-01                               |
| `src/lib/storage/json-file.ts`             | Persistência atômica, backup, lock | DATA-01, DATA-04, DATA-05, DATA-07, DATA-09 |
| `src/lib/storage/index.ts`                 | Singleton/factory                  | DATA-10                                     |
| `src/lib/feed/parse.ts`                    | Parser RSS/Atom                    | SEC-01                                      |
| `src/lib/feed/refresh.ts`                  | Fetch/refresh/cache                | SEC-05, DATA-02, DATA-03, UX-05, UX-06      |
| `src/lib/feed/scheduler.ts`                | Job periódico                      | DATA-02, DATA-03                            |
| `src/lib/feed/view.ts`                     | View model/snapshots               | SEC-01, ORG-07                              |
| `src/lib/feed/filter.ts`                   | Regras e highlight                 | UX-08, UX-16                                |
| `src/lib/net/safe-fetch.ts`                | SSRF/timeout/limite                | SEC-05, ORG-05, PLAT-03                     |
| `src/lib/search.ts`                        | Índice Fuse                        | UX-02, ORG-06                               |
| `src/lib/components/FeedCard.svelte`       | Card do post                       | UX-01, UX-08                                |
| `src/lib/components/FeedBoard.svelte`      | Filtros/visões/ações               | UX-08, UX-09, ORG-08, ORG-13                |
| `src/lib/components/CommandPalette.svelte` | Busca/comandos                     | UX-02, UX-11, ORG-06                        |
| `src/lib/components/ManageEditor.svelte`   | Editor lateral                     | UX-03, UX-13, UX-16, ORG-12                 |
| `src/lib/components/HomeDashboard.svelte`  | Home                               | UX-05, UX-07, ORG-17, PLAT-06               |
| `src/lib/components/Sidebar.svelte`        | Navegação                          | UX-04, UX-10, ORG-07                        |
| `src/routes/gerenciar/+page.svelte`        | CRUD                               | UX-03, UX-04, UX-12, DATA-08                |
| `src/routes/+layout.server.ts`             | Load global/fallback               | DATA-10                                     |
| `src/routes/+layout.svelte`                | Shell/palette                      | UX-11                                       |
| `src/hooks.server.ts`                      | Host/Origin/headers                | SEC-02                                      |
| `src/app.css`                              | Tokens/estilos                     | UX-14, PLAT-10, PLAT-08                     |
| `src/app.html`                             | Head/fontes/favicon                | UX-15, PLAT-01, PLAT-03                     |

---

## Apêndice B — Comandos úteis

```powershell
# desenvolvimento
npm run dev

# qualidade
npm test
npm run check
npm run lint
npm run format

# build local
npm run build
npm start

# backup manual antes de migração
Copy-Item data -Destination "data-backup-$(Get-Date -Format yyyyMMdd-HHmmss)" -Recurse

# copiar este plano para a raiz do projeto (quando estiver em modo de implementação)
Copy-Item "C:\Users\PICHAU\.opencode\plan\plano-execucao-ihub.md" "C:\Users\PICHAU\Desktop\iHub\PLANO-EXECUCAO.md"
```

---

## Apêndice C — Checklist de PR

- [ ] A tarefa tem ID e critério de aceite.
- [ ] Testes adicionados/atualizados.
- [ ] `npm test`, `check`, `lint` verdes.
- [ ] Acessibilidade verificada.
- [ ] Mobile 375 px verificado.
- [ ] Dados/backup não commitados.
- [ ] README/HANDOFF atualizados se necessário.
- [ ] Sem `console.log` de debug.
- [ ] Sem dependência nova sem justificativa.
- [ ] Commit convencional.
- [ ] Rollback descrito (se schema/migração).

---

## Apêndice D — Rastreabilidade das recomendações anteriores

| Recomendação da análise                             | Task(s)       |
| --------------------------------------------------- | ------------- |
| Título do card clicável                             | UX-01         |
| Busca promete feed e não busca                      | UX-02, ORG-06 |
| “Adicionar” cai no lugar errado                     | UX-03         |
| “Nova categoria”/editar grupo sem contexto          | UX-04         |
| Fonte desligada conta como erro                     | UX-05         |
| Cache antigo ao mudar target                        | UX-06         |
| Métricas/fontes não clicáveis                       | UX-07         |
| Busca de salvos ignora resumo; resumo sem highlight | UX-08         |
| Marcar tudo sem confirmação/undo                    | UX-09         |
| Terminologia inconsistente                          | UX-10         |
| Palette sem trap/clique fora                        | UX-11         |
| Switch sem semântica                                | UX-12         |
| Editor sem dirty guard                              | UX-13         |
| Contraste/opacidade/texto pequeno                   | UX-14         |
| Sem favicon                                         | UX-15         |
| “Destacar” que filtra                               | UX-16         |
| URL de feed/snapshot sem allowlist                  | SEC-01        |
| Sem CSP/headers                                     | SEC-02        |
| State/cache sem validação                           | SEC-03        |
| Body sem limite                                     | SEC-04        |
| SSRF no refresh                                     | SEC-05        |
| Concorrência de escrita                             | DATA-01       |
| Refresh concorrente                                 | DATA-02       |
| Refresh sequencial                                  | DATA-03       |
| rename no Windows/OneDrive                          | DATA-04       |
| read map cresce                                     | DATA-05       |
| Cache órfão                                         | DATA-06       |
| Sem migrações                                       | DATA-07       |
| Import sem diff/validação                           | DATA-08       |
| Backup único                                        | DATA-09       |
| Abstração do storage vaza                           | DATA-10       |
| Sem ações em massa                                  | ORG-01        |
| Sem drag & drop                                     | ORG-02        |
| Tags subutilizadas                                  | ORG-03        |
| Sem importar bookmarks/OPML                         | ORG-04        |
| Sem quick add/bookmarklet                           | ORG-05        |
| Palette não é command palette                       | ORG-06        |
| Sem não lidos por categoria/fonte                   | ORG-07        |
| Sem “marcar antigos”                                | ORG-08        |
| Sem atalhos de triagem                              | ORG-09        |
| Filtros sem escopo                                  | ORG-10        |
| Sem link health/duplicados                          | ORG-11        |
| Sem testar fonte                                    | ORG-12        |
| Sem chip por fonte                                  | ORG-13        |
| Sem página de grupo/abrir tudo                      | ORG-14        |
| Sem recentes/frequência                             | ORG-15        |
| Fontes sem ordem                                    | ORG-16        |
| Acesso rápido pouco customizável                    | ORG-17        |
| Nota em localStorage                                | ORG-18        |
| Primeiro uso manual                                 | ORG-19        |
| Sem reader mode                                     | READ-01       |
| Sem highlights/notas                                | READ-02       |
| Sem arquivo/offline                                 | READ-03       |
| Sem export Markdown                                 | READ-04       |
| Sem busca full-text/estatísticas                    | READ-05       |
| Sem TTS                                             | READ-06       |
| Sem PWA/manifest                                    | PLAT-01       |
| Sem autostart                                       | PLAT-02       |
| Fontes/ícones externos, sem no-referrer             | PLAT-03       |
| Sync sem conflito                                   | PLAT-04       |
| API sem token/health                                | PLAT-05       |
| Home fixa/sem widgets                               | PLAT-06       |
| Sem notificações/badge                              | PLAT-07       |
| Mobile/densidade/tema                               | PLAT-08       |
| Sem CI/e2e                                          | PLAT-09       |
| CSS monolítico/cores fixas                          | PLAT-10       |
| Modelo de erro/nomes                                | PLAT-11       |
| Performance não medida                              | PLAT-12       |

---

## Apêndice E — Ordem de commits sugerida (primeiras 20)

```
1.  docs: add execution plan and baseline
2.  fix(feed): make post titles links in all views
3.  fix(ui): align search copy with palette behavior
4.  feat(manage): deep-link add flows with category context
5.  fix(sidebar): open category creation from Nova categoria
6.  fix(home): ignore disabled sources in error count
7.  fix(feed): invalidate cache when source target changes
8.  feat(home): make metrics and sources actionable
9.  fix(saved): search summaries and highlight matches
10. feat(feed): confirm and undo mark-all-read
11. refactor(ui): unify saved/link terminology
12. fix(a11y): trap focus and close palette on backdrop
13. fix(a11y): expose source toggle as switch
14. feat(editor): warn before discarding unsaved changes
15. fix(a11y): raise contrast and remove read opacity
16. feat(ui): add favicon and theme metadata
17. fix(editor): rename source include rule to filter
18. feat(security): allowlist http(s) URLs for feeds and snapshots
19. feat(security): add CSP and security headers
20. feat(schema): validate hub state and feed cache
```

---

**Fim do plano.**  
Para executar, sugere-se começar pelo Sprint 0 + Fase 0, com backup do `data/` e tag `v0.6.0` antes de qualquer mudança de schema.
