# Meu Hub

Hub pessoal local (página inicial do navegador) com links, apps do PC e um feed por palavra-chave. Roda apenas no seu computador, em `localhost`.

> Handoff técnico (o que foi feito, como e pendências): [HANDOFF.md](HANDOFF.md).

## Status

- **Concluído:** M0–M5, Sprint 0, Sprint 1 (P0 de UX), fase de segurança, fase de dados (locks, backups e restauração), triagem do feed (não lidos, chips, filtros com escopo), seleção em massa com atalhos, captura rápida (bookmarks/OPML, quick add e bookmarklet), organização manual (ordem de fontes e drag & drop de itens), PWA/offline, autostart no Windows e tags como filtro.
- **Versão atual:** `v0.17.0` · **440 testes** em 58 arquivos.
- **Próximos blocos planejados:** leitura (reader/highlights).
- O plano completo e o histórico ficam em [PLANO-EXECUCAO.md](PLANO-EXECUCAO.md) e [HANDOFF.md](HANDOFF.md).

## Stack

SvelteKit 3 + Svelte 5 (runes) + TypeScript, `@sveltejs/adapter-node`, Vitest, Zod, Fuse.js, `fast-xml-parser` e adapter-node. Tema escuro único, responsivo.

## Instalar em outra máquina (Windows)

### 1. Pré-requisitos

- Windows 10/11.
- **Node.js 24 ou superior** (<https://nodejs.org>).
- Git (<https://git-scm.com>).

Confira no PowerShell:

```powershell
node -v
npm -v
git --version
```

### 2. Baixar o projeto

```powershell
git clone https://github.com/josemelao/ihub.git
cd ihub
npm ci
```

`npm ci` instala exatamente as versões do `package-lock.json`. Use `npm install` apenas se estiver alterando dependências.

### 3. Primeira execução sem dados antigos

```powershell
Copy-Item data\hub.example.json data\hub.json
npm run build
npm start
```

Abra <http://127.0.0.1:5757>.

O `npm start` fica preso ao terminal (é o servidor). Para parar, use `Ctrl+C`.

### 4. Migrar os dados do PC antigo

Com o app **fechado nos dois PCs**:

1. No PC antigo, copie a pasta `data` inteira.
2. No PC novo, substitua a pasta `data` do projeto pela copiada.
3. Se quiser manter os pontos de restauração, copie também `data\backups`.
4. Inicie o app e confira os dados.

Alternativa sem copiar arquivos: no PC antigo use **Gerenciar → Exportar**, leve o JSON e use **Gerenciar → Importar** no PC novo.

> Não copie `node_modules`, `.svelte-kit` ou `build` entre máquinas. Não rode dois servidores apontando para a mesma pasta ao mesmo tempo.

### 5. Configuração opcional

```powershell
Copy-Item .env.example .env
```

Variáveis aceitas:

| Variável       | Padrão      | Função                                                             |
| -------------- | ----------- | ------------------------------------------------------------------ |
| `HOST`         | `127.0.0.1` | interface de rede (**não exponha na rede**)                        |
| `PORT`         | `5757`      | porta                                                              |
| `HUB_DATA_DIR` | `data`      | pasta dos JSON (pode ser uma pasta sincronizada do Drive/OneDrive) |

Sem `.env`, os padrões acima já funcionam.

### 6. Rodar em desenvolvimento

```powershell
npm run dev
```

Abre em <http://127.0.0.1:5757> com recarregamento automático.

### 7. Atualizar o app

Com o servidor parado (`Ctrl+C`):

```powershell
# opcional: crie um ponto de restauração em Gerenciar → Backups antes
git pull
npm ci
npm run verify
npm run build
npm start
```

### 8. Problemas comuns

- **Porta ocupada (`EADDRINUSE`):** feche o processo na porta 5757 ou defina `PORT` no `.env`.
- **“Host não permitido”:** acesse por `http://127.0.0.1:5757` ou `http://localhost:5757`; o servidor não aceita outros hosts.
- **JSON inválido:** o app mostra o problema e tenta o backup `.bak`; restaure um ponto em **Gerenciar → Backups** se necessário.
- **Node antigo:** `node -v` precisa ser 24+.
- **Feed não atualiza:** confira o status em **Gerenciar → Fontes**; erros de rede/rate limit aparecem por fonte.
- **Backup/restauração:** os pontos manuais ficam em `data\backups\manual-*` e podem ser baixados pela aba **Backups**.

### 9. Iniciar com o Windows

Autostart por usuário, sem admin:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1
```

O script cria um atalho `Meu Hub.lnk` na pasta **Startup** que roda `scripts/start-hidden.vbs` oculto, iniciando `node scripts/start.mjs`. Requer Node 24+ e `npm run build` já executado.

O `start.mjs` verifica se o build existe e se a porta 5757 já está em uso, gravando o motivo em `data/autostart.log` quando algo falha. Para preparar `.env` e `data/hub.json`:

```powershell
npm run setup
```

Para desativar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\uninstall-autostart.ps1
```

Detalhes e limitações: [docs/pwa.md](docs/pwa.md).

## Dados

Tudo passa por uma camada de storage (`src/lib/storage/json-file.ts`) com escrita atômica e backup `.bak`.

- `data/hub.example.json` — seed de exemplo versionado (mockups).
- `data/hub.json` — seus dados reais: categorias, grupos, itens (links/apps), fontes do feed e filtros salvos. **Não entra no Git.**
- `data/estado.json` — lidos/salvos, incluindo um snapshot dos posts salvos (criado quando necessário; não entra no Git).
- `data/feed-cache.json` — posts já buscados e status por fonte (regenerável; não entra no Git).

Edite o `hub.json` e recarregue a página. Se o JSON tiver erro, o app **não quebra**: mostra um aviso com o caminho do problema e usa `hub.json.bak` (o último arquivo válido), quando existir.

O schema e as referências (categoria/grupo inexistente, id duplicado, URL inválida, protocolo inseguro) são validados por Zod em `src/lib/schema.ts`.

### Biblioteca e ícones

A página **Biblioteca** (`/biblioteca`) reúne **links e apps do PC** no mesmo lugar:

- Abas **Todos / Apps do PC / Navegador** e busca local por nome, grupo, categoria ou tag.
- Cada **categoria é um acordeão**: clique no cabeçalho para recolher/expandir. O estado fica salvo no navegador; **Recolher tudo / Expandir tudo** aplica a todas. Ao buscar, as categorias com resultados abrem automaticamente; ao limpar, o estado anterior volta.
- A sidebar mostra, por categoria, **itens · fontes de feed** (ex.: `17 · 3`), com detalhes no tooltip.
- Organização por **categoria → grupo**. Um grupo pode combinar serviços do mesmo assunto (ex.: Darktide = app na Steam + site de builds + wiki + subreddit), e cada item mantém seu `type` (`app` ou `link`).
- Itens sem grupo aparecem em **“Sem grupo”**.
- **Ícones**: links usam o favicon do domínio (via DuckDuckGo) e apps usam o ícone do protocolo (Simple Icons, ex.: `steam://` → Steam). Se a imagem falhar, aparecem as iniciais.
- **Descrição curta** opcional por item aparece no card da Biblioteca, no tooltip do Acesso rápido e na busca.
- O campo opcional `icon` sobrescreve o ícone: use um slug do Simple Icons (`github`) ou uma URL `https://...`.
- A rota antiga `/apps` redireciona para `/biblioteca`.

### Tags

- A **Biblioteca** mostra uma linha de chips com as tags e a contagem de itens.
- Clicar em uma tag filtra a lista; o filtro combina com busca, abas de tipo e categorias.
- A URL reflete o filtro (`/biblioteca?tag=build`) e sobrevive a reload/compartilhamento.
- Em **Gerenciar → Tags**, renomeie uma tag e ela é atualizada em todos os itens; se o destino já existir, as tags são mescladas. **Remover** tira a tag de todos os itens sem apagar os itens.
- O editor de item sugere as tags já existentes.
- `Build`, `build ` e `BUILD` contam como a mesma tag; a primeira grafia é preservada.
- Detalhes: [docs/tags.md](docs/tags.md).

### Feed (M3)

- Busca automática a cada ~60 s apenas nas fontes cujo intervalo venceu, e também pelo botão **Atualizar agora** (home, categoria, feed e Gerenciar).
- Tipos de fonte: **RSS/Atom** (URL direta), **Reddit** (nome do subreddit ou URL do `.rss`) e **YouTube** (`@handle`, URL do canal, ID `UC...` ou URL `feeds/videos.xml?channel_id=...`).
- Cada fonte tem intervalo próprio e **limite de posts** (10/20/30/50/100; padrão 30), além de poder ser atualizada individualmente em **Gerenciar → Fontes**.
- Regras por fonte: `include`/`exclude` e `matchMode` (`any`/`all`), aplicadas sobre título + resumo, sem diferenciar maiúsculas nem acentos. Uma fonte com erro não derruba as outras; o status aparece em **Gerenciar** e em **Feed completo**.
- Filtro ao vivo no **Feed completo** e na categoria: palavra-chave, alternância qualquer/todas, filtros salvos com contagem, chips de categoria e de fonte com não lidos, "Não lidos" e destaque do trecho encontrado.
- **+ Salvar filtro** captura a busca atual num formulário em linha com **Nome, Incluir, Excluir, Modo, Categoria, Fonte e "Somente não lidos"**. Os filtros podem ser editados/removidos em Gerenciar → Regras.
- **Marcar antigos** permite marcar como lido o que está na visão atual com mais de 1, 3 ou 7 dias, com desfazer por 30 segundos.
- O contador de não lidos da sidebar usa a mesma visão do feed (ignora fontes removidas/desligadas); cache de fonte removida é limpo ao carregar.
- **Selecionar** entra no modo de seleção: clique em qualquer lugar do card (ou no checkbox) para alternar, shift+clique redefine o intervalo (desmarcando quem ficou fora), e barra de ações em lote (lido/não lido, salvar/remover, selecionar todos).
- Atalhos no feed: `j`/`k` navegam, `m` marca lido, `s` salva, `o`/`Enter` abrem, `?` mostra a ajuda e `Esc` sai da seleção.
- A **Acesso rápido** fica no card de mesmo nome no topo da home (grade compacta, até 6 atalhos).
- Ações por post: **Abrir**, **Salvar para depois** e **Marcar como lido** — exibidas como ícones (link externo, bookmark e check), com tooltip e `aria-label`. Os posts salvos aparecem em **Favoritos**; o contador da sidebar mostra não lidos. Ao salvar, um snapshot do post é guardado, então ele continua em Favoritos mesmo se a fonte for removida ou o cache expirar.
- **Vídeos do YouTube**: a thumbnail mostra um botão **▶**; o clique abre um player em modal com `youtube-nocookie` e autoplay, sem alterar o layout do Bento. O modal fecha por Esc, botão fechar ou clique fora e tem o atalho **Abrir no YouTube**.
- **Vídeos do Reddit**: a thumbnail mostra um selo **Reddit**; ao clicar, o hub consulta o embed oficial e detecta se o post é vídeo. Se for, abre o player do Reddit em modal; se não, mantém o lightbox de imagem. O resultado fica em cache por 10 minutos. Não há scraping do JSON nem extração de MP4/HLS. O idioma do player vem da fonte: **Exibir em inglês** (`locale=en`) ou navegador quando desligado; snapshots de salvos preservam essa escolha.
- **Imagens do feed**: thumbnails que não são vídeo abrem um **lightbox** com a imagem, título e atalhos **Abrir imagem** e **Abrir publicação**; não é mais necessário sair do hub só para ver a imagem.
- **Visualizações**: **Bento** (masonry em colunas iguais: 2 colunas, 3 quando o feed está largo, imagens 3:2 e retrato adaptativo), **Compacto** (imagem ou placeholder com o nome da fonte, meta, título e ações; sem excerpt) e **Completo** (lista com imagem lateral maior e texto expansível). A escolha fica salva no navegador.
- No Bento o texto flui naturalmente (sem corte de linhas) e o masonry posiciona cada card na coluna mais curta, sem buracos.
- Cards filtrados/marcados como lidos desaparecem com fade e os restantes deslizam para a nova posição. **Ao entrar/trocar de página ou trocar de visualização não há animação**; ela só é ativada após o feed assentar (~400ms) e passa a valer para filtros, busca, lidos e “Carregar mais”. Respeita `prefers-reduced-motion`.
- A **home é um painel geral**: faixa de 3 cards (Acesso rápido, Resumo do dia, Ações rápidas), só as **5 últimas notícias** e o botão “Ver feed completo”. Os filtros ficam no Feed completo.
- A barra direita é fixa/sticky e mostra Fontes do feed, Filtros salvos, Salvos recentemente e Nota rápida. A sidebar esquerda é fixa, com rodapé fixo e engrenagem no topo.
- Imagens vêm de `media:*`, `enclosure`, do primeiro `<img>` do conteúdo e, para YouTube, do ID do vídeo.
- Cache: até 30 posts por fonte, retenção de 30 dias, deduplicação por URL/guid. Requisições com timeout de 10 s, User-Agent identificado e limite de 5 MB por resposta.

> Observações: o feed RSS do Reddit pode sofrer rate limit (429) — o erro fica visível e a fonte tenta de novo no próximo intervalo. Para YouTube, o hub aceita `@handle`, URL do canal ou ID `UC...` e resolve o ID automaticamente.

### Exportar e importar

Na tela **Gerenciar**:

- **Exportar dados** baixa um `hub-export-AAAA-MM-DD.json` com o hub e o estado.
- **Importar dados** lê o arquivo, valida e mostra um resumo antes de confirmar. Escolha **substituir tudo** ou **mesclar por id**. Um backup do `hub.json` atual é criado automaticamente.

### Captura rápida

- **Importar favoritos/OPML**: aceita o `bookmarks.html` do Chrome/Edge/Firefox e arquivos `.opml`/`.xml`. Pastas viram categorias/grupos (ou grupos dentro de uma categoria escolhida), URLs repetidas são ignoradas e links entram com a tag `importado`. O preview lista duplicados e itens inválidos com o motivo. A importação só adiciona; nunca apaga.
- **Exportar OPML**: baixa `ihub-feeds.opml` com as fontes agrupadas por categoria/grupo; reimportar mantém nome, URL e pastas.
- **Exportar favoritos**: baixa `ihub-bookmarks.html` no formato Netscape; reimportar mantém links, nomes e pastas.
- **Adicionar rápido** (sidebar): cole uma URL e o app busca título, descrição e ícone antes de abrir o editor. Se a página não puder ser lida, o editor abre só com a URL.
- **Bookmarklet** em Gerenciar → Itens: arraste **Salvar no Hub** para a barra de favoritos e clique em qualquer site para abrir o editor já preenchido. Sites com CSP rígida podem bloquear bookmarklets; nesse caso use **Adicionar rápido**.
- Detalhes, limites e checklist: [docs/capture.md](docs/capture.md).

### Organização manual

- **Ordem de fontes**: em Gerenciar → Fontes, use ↑/↓ para reordenar dentro da categoria. A ordem vale para home, feed, categoria e filtros salvos e é gravada no `hub.json` (fontes antigas recebem a posição atual no load).
- **Drag & drop de itens**: em Gerenciar → Itens, arraste pelo handle **⋮⋮** e solte em outro grupo (ou “Sem grupo”). O item vai para o fim do grupo destino, com `categoryId`/`groupId` e ordem atualizados.
- **Fallback**: ↑/↓ continua reordenando; no mobile, use **Editar** ou os botões ↑/↓. DnD de grupos/categorias/fontes ainda não entrou.
- Detalhes: [docs/organization.md](docs/organization.md).

### Editar pela interface (M4)

Em **Gerenciar**, as abas são funcionais:

- **Fontes do feed**: adicionar, editar, remover, ligar/desligar, **atualizar só uma fonte** e buscar por nome/alvo/grupo/categoria. Status de cada fonte. Para Reddit, um interruptor **Exibir em inglês** define `locale=en`; desligado usa o idioma do navegador.
- **Itens**: links e apps juntos, com subchips **Todos / Links / Apps**, busca local e agrupamento por **categoria → grupo** (inclui “Sem grupo”). Adicionar link e adicionar app ficam no cabeçalho.
- **Grupos**: criar, renomear, mover de categoria, reordenar (↑/↓) e remover (bloqueia se tiver itens ou fontes).
- **Categorias**: adicionar, renomear/cor, reordenar (↑/↓) e remover (bloqueia se estiver em uso). Mostra itens, grupos e fontes.
- **Filtros salvos**: adicionar/editar/remover filtros de busca, com Incluir, Excluir, Modo, Categoria, Fonte e “Somente não lidos”.
- **Backups**: criar, listar, baixar, restaurar e excluir pontos de restauração; mostra a idade do último backup automático.
- **Aparência**: escolher a cor de destaque do tema (predefinidas ou cor personalizada).

O editor lateral é compacto, dividido em seções (**Fonte/Organização/Atualização/Filtros**, **Identificação/Organização/Aparência/Extras**), com cabeçalho e rodapé fixos — os botões **Cancelar/Salvar** ficam sempre visíveis. A remoção usa um diálogo próprio, no tema escuro, em vez do `confirm()` do navegador.

O botão **Adicionar** abre um painel lateral com formulário específico. Para fontes RSS, o botão **Detectar** procura automaticamente o feed na página informada. Toda alteração é validada pelo Zod e gravada no `hub.json` de forma atômica, com backup `.bak`.

### Sincronizar entre dois PCs (Google Drive / OneDrive)

Não há integração com a API do Drive. A sincronização é feita pela **pasta sincronizada** do Drive/OneDrive:

1. Instale o Drive/OneDrive nos dois PCs e deixe a pasta sincronizando.
2. Crie um `.env` em cada PC apontando `HUB_DATA_DIR` para essa pasta, por exemplo:
   ```env
   HUB_DATA_DIR=C:\Users\SeuUsuario\Google Drive\MeuHub
   ```
3. Coloque o `hub.json` nessa pasta (ou exporte de um PC e importe no outro).

O servidor relê o `hub.json` a cada requisição, então basta recarregar a página para ver mudanças vindas do outro PC. **Evite editar ao mesmo tempo nos dois PCs**: a última gravação vence. Para trocas pontuais, prefira exportar/importar.

## Telas

| Rota                  | Tela                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------- |
| `/`                   | Início: painel geral, 5 últimas notícias, acesso rápido, resumo, ações e painel direito |
| `/c/[slug]`           | Categoria: grupos, links/apps e feed restrito à categoria                               |
| `/feed`               | Feed completo com filtros e fontes cadastradas                                          |
| `/favoritos`          | Posts salvos para depois, com busca e ordenação por salvos/publicados                   |
| `/biblioteca`         | Biblioteca: abas Todos/PC/Navegador, busca, categorias → grupos → links/apps            |
| `/apps`               | Redireciona para `/biblioteca`                                                          |
| `/gerenciar`          | Fontes/links/apps/grupos, edição, status do feed, exportar/importar                     |
| `/api/hub`            | JSON do hub validado (GET) e mutações validadas (POST)                                  |
| `/api/export`         | Download do bundle (hub + estado)                                                       |
| `/api/import`         | Importação validada (substituir/mesclar)                                                |
| `/api/feed`           | Cache do feed com status por fonte                                                      |
| `/api/refresh`        | Dispara a atualização de todas as fontes (`async: true` devolve um job com progresso)   |
| `/api/refresh/status` | Progresso de um job de atualização (`?id=`)                                             |
| `/api/state`          | Lidos/salvos (GET) e ações como read/save/mark-all-read (POST)                          |
| `/api/discover-feed`  | Descobre o feed RSS/Atom de uma página (POST)                                           |

## Segurança e privacidade

- Todo tráfego é local (`127.0.0.1`); `Host`/`Origin` de outros domínios são bloqueados com 403.
- `Content-Security-Policy` roda em **enforce** (não Report-Only): `default-src 'self'`, scripts e estilos próprios, `object-src 'none'`, `frame-ancestors 'none'`. Players liberados apenas para `youtube-nocookie.com` e `redditmedia.com`.
- Fontes (Inter/Space Grotesk) são servidas de `static/fonts`; não há requisição a Google Fonts.
- Toda imagem externa usa `referrerpolicy="no-referrer"`.
- URLs de feed/imagem só são aceitas em `http(s)`; o fetch valida o IP resolvido e bloqueia rede interna (SSRF).
- Para ajustar a CSP (ex.: nova origem de iframe), edite `src/lib/security/headers.ts` e rode `npm run verify`; o teste `headers.test.ts` cobre as diretivas.
- Arquivos em `data/*.json` e `.env` ficam fora do Git. O service worker nunca cacheia `/api/` nem `data/`.

## Estrutura

```
src/
  lib/
    types.ts              # tipos do domínio
    schema.ts             # validação Zod + referências
    display.ts            # helpers de exibição (iniciais, cor, contagens)
    storage/              # JsonFileStorage e fábrica
    feed/                 # parser RSS/Atom, refresh, filtros, view e scheduler
    components/           # Sidebar, TopBar, QuickAccess, FeedBoard, cards...
  routes/                 # páginas e APIs
data/hub.example.json     # seed versionado
data/hub.json             # seus dados (ignorado pelo Git)
mockups/                  # referências visuais (.dc.html) — não é o app
PLANEJAMENTO-hub.md       # decisões, fases e critérios de aceite
```

## PWA e offline

- Manifest e service worker permitem instalar o hub no Chrome/Edge e abrir uma tela de aviso quando o servidor local está parado.
- O service worker guarda apenas o shell estático e `offline.html`; nunca cacheia `/api/` nem arquivos de `data/`.
- No Chrome/Edge, use **Instalar aplicativo** em <http://127.0.0.1:5757>.
- Detalhes: [docs/pwa.md](docs/pwa.md).

## Qualidade

```powershell
npm run verify  # check + lint + testes + build
npm test        # Vitest (schema, storage, helpers, edição, feed, players e seed)
npm run check   # svelte-check
npm run lint    # Prettier + ESLint
```

`npm audit --omit=dev` não encontra vulnerabilidades de runtime. Os avisos restantes do `npm audit` são de dependências de desenvolvimento (ESLint) e não afetam o app.

O plano de evolução e as decisões dos sprints ficam em [`PLANO-EXECUCAO.md`](PLANO-EXECUCAO.md), [`docs/sprint-0.md`](docs/sprint-0.md), [`docs/sprint-1.md`](docs/sprint-1.md), [`docs/security.md`](docs/security.md), [`docs/data.md`](docs/data.md), [`docs/triage.md`](docs/triage.md), [`docs/bulk.md`](docs/bulk.md) e [`docs/checklist-regressao.md`](docs/checklist-regressao.md).

## Mockups

Os arquivos em `mockups/` são referências visuais exportadas de ferramenta de design (rodam com React via `support.js`). Para vê-los:

```powershell
python -m http.server 8000
# http://localhost:8000/mockups/Main.dc.html
# http://localhost:8000/mockups/Categoria.dc.html
# http://localhost:8000/mockups/Gerenciar.dc.html
```

Eles não fazem parte do build do app.

## Segurança e limites

- Servidor só em `127.0.0.1`, com allowlist de Host/Origin; CSRF nativo do SvelteKit.
- Apps abrem apenas por protocolo (`steam://`, `discord://`, `vscode://`...). Protocolos `javascript:`, `data:`, `vbscript:` e `file:` são rejeitados. Execução de comandos fica para a V2, com lista permitida.
- URLs de itens de feed, thumbnails e snapshots só aceitam `http(s)`; itens perigosos são descartados/rejeitados.
- `estado.json` e `feed-cache.json` são validados por Zod; arquivo inválido tenta `.bak` e avisa no layout.
- APIs têm limite de corpo: 2 MB em hub/state, 10 MB em import e 64 KB nas APIs pequenas; excesso retorna 413.
- O refresh de feeds usa fetch seguro: timeout, 5 MB, bloqueio de loopback/IP privado e validação de redirects.
- Headers de segurança ativos: `nosniff`, `no-referrer`, `X-Frame-Options: DENY` e `Permissions-Policy`.
- CSP em **enforce** (v0.19.0): `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` e players liberados só para YouTube-nocookie/Redditmedia. `script-src` mantém `'unsafe-inline'` porque o SvelteKit injeta o script de hidratação; nonce/hash fica para PLAT-09.
- Assets estáticos (`/fonts/*`, `/_app/*`) são servidos pelo adapter-node antes do `hooks.server`; os headers de segurança cobrem HTML e APIs (ver `docs/security.md`).
- Escritas usam lock por processo + gravação atômica com retry para `EPERM`/`EBUSY`; hub e cache de uma fonte são atualizados na mesma transação.
- Refresh é coalescido: scheduler e botão “Atualizar feed” compartilham a mesma execução, sem fetches duplicados.
- Backups automáticos mantêm `.bak` + 6 gerações rotativas. A aba **Backups** cria pontos datados em `data/backups/`, com caminho absoluto, download, restauração (com ponto de segurança antes) e exclusão.
- Escritas da interface (POST/DELETE) enviam `content-type: application/json`; o CSRF do SvelteKit bloqueia POST/DELETE vazio ou form com **403** (proteção intencional).
- Importação mostra o diff (novos/atualizados/removidos) e a política de settings antes de aplicar.
- `estado.json` é podado: leituras com mais de 90 dias (exceto posts salvos) e snapshots órfãos saem automaticamente.
- Sem login, sem versão online, sem tema claro.
- Escrita de links/fontes pela interface é validada e restrita ao `hub.json`.
- O descobridor de feeds só acessa `http(s)` públicos (bloqueia loopback/redes privadas) e limita o tamanho da resposta.

### Descobrir o protocolo de um app (Windows)

1. Teste o esquema no Executar (`Win+R`): `steam://`, `discord://`, `vscode://`, `obsidian://`, `spotify://`, `ms-word:`.
2. No Editor do Registro, procure `HKEY_CLASSES_ROOT\<esquema>` para ver o handler instalado.
3. Muitos apps expõem o esquema em "criar atalho" ou na documentação; use o texto antes de `://` (ou antes de `:` em `ms-word:`).

### Rede do trabalho e proxy

O servidor busca RSS/YouTube/Reddit diretamente. Se a rede do trabalho exigir proxy, o `fetch` do Node não usa `HTTPS_PROXY` automaticamente; nesse caso use VPN ou configure o proxy no nível do sistema/rede. Para diagnosticar, use **Gerenciar → Atualizar agora** e veja o erro de cada fonte.
