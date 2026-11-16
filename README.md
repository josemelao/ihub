# Meu Hub

[![CI](https://github.com/josemelao/ihub/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/josemelao/ihub/actions/workflows/ci.yml)
[![Versão](https://img.shields.io/github/v/tag/josemelao/ihub?label=vers%C3%A3o&sort=semver)](https://github.com/josemelao/ihub/tags)
[![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-3-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Testes](https://img.shields.io/badge/testes-927%20unit%20%2B%2054%20e2e-brightgreen)](#qualidade)

Hub pessoal **local-first** que funciona como página inicial do navegador: links, apps do Windows e um leitor de feeds RSS/Atom, Reddit e YouTube — sem login, sem nuvem e sem telemetria. O servidor escuta apenas em `127.0.0.1` e os dados ficam em `data/` na sua máquina.

> **Documentação técnica:** [HANDOFF.md](HANDOFF.md) (histórico e decisões), [PLANO-EXECUCAO.md](PLANO-EXECUCAO.md) (backlog e critérios) e [docs/](docs/) (temas específicos).

## Sumário

- [Status](#status)
- [Recursos](#recursos)
- [Stack](#stack)
- [Instalar em outra máquina (Windows)](#instalar-em-outra-máquina-windows)
- [Dados](#dados)
- [Telas](#telas)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Estrutura](#estrutura)
- [PWA e offline](#pwa-e-offline)
- [Qualidade](#qualidade)
- [Mockups](#mockups)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Status

- **Versão atual:** `v0.37.0`.
- **Qualidade:** **927 testes unitários** em 148 arquivos + **54 E2E**; `npm run verify` verde; axe sem violações críticas/sérias nas telas principais.
- **Plataforma:** Windows 10/11, Node.js 24+, servidor local em `127.0.0.1:5757`.
- **Escopo:** uso pessoal **single-machine**. PLAT-04 (sincronização entre PCs) e PLAT-06 (widgets/layout da home) foram descartados; o layout atual está fechado.
- **Próximos passos:** manutenção e dívidas opcionais — veja [HANDOFF.md](HANDOFF.md).

## Recursos

- **Biblioteca** de links e apps do Windows, organizada por categoria → grupo, com busca, tags e ícones em cache local.
- **Feed completo** de RSS/Atom, Reddit e YouTube, com filtros por palavra-chave, não lidos, fontes e filtros salvos.
- **Leitura sem sair**: reader mode, destaques com notas/cores, arquivo offline da página e busca no texto dos salvos.
- **Salvar para depois** com snapshots, exportação em Markdown e página de Salvos com estatísticas de leitura.
- **Organização e captura**: importar favoritos/OPML, quick add, bookmarklet, DnD de itens e tags.
- **Operação local**: backup em ZIP, pontos de restauração, diagnóstico, PWA/offline e autostart no Windows.
- **Privacidade**: sem login, sem nuvem, sem telemetria; favicons e fontes servidos/cacheados pelo próprio hub.

## Stack

SvelteKit 3 + Svelte 5 (runes) + TypeScript, `@sveltejs/adapter-node`, Vitest, Playwright, Zod, Fuse.js e `fast-xml-parser`. Tema escuro único, responsivo e acessível.

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

Sem `hub.json`, o app mostra uma tela de primeiro uso com **Começar com exemplo** (copia o seed) e **Começar vazio**; também informa o diretório de dados (`data/` ou `HUB_DATA_DIR`).

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

- `HUB_API_TOKEN` (opcional): quando definido, todo POST/DELETE em `/api/*` exige `Authorization: Bearer <token>`. GETs continuam abertos para a própria máquina.

```powershell
Copy-Item .env.example .env
```

Variáveis aceitas:

| Variável       | Padrão      | Função                                              |
| -------------- | ----------- | --------------------------------------------------- |
| `HOST`         | `127.0.0.1` | interface de rede (**não exponha na rede**)         |
| `PORT`         | `5757`      | porta                                               |
| `HUB_DATA_DIR` | `data`      | pasta dos JSON (mantenha local; uso single-machine) |

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
- **Backup/restauração:** os pontos manuais ficam em `data\backups\manual-*` e podem ser baixados pela aba **Backups**. O ZIP completo (com `reading/` e, opcionalmente, `archive/`) restaura descompactando sobre `data\` com o servidor parado.

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
- `data/notes.json` — notas do hub e da nota rápida (não entra no Git).
- `data/highlights.json` — destaques e notas por item salvo (não entra no Git).
- `data/reading/<id>.json` — texto completo extraído pelo reader, já sanitizado (não entra no Git).
- `data/archive.json` e `data/archive/<id>/` — cópia local da página inteira (HTML + imagens) dos posts salvos (não entra no Git).
- `data/link-status.json` — resultado da última verificação de links (regenerável; não entra no Git).
- `data/usage.json` — contagem e última abertura de links/apps para Recentes/Mais usados (regenerável; não entra no Git).
- `data/icons/` — favicons baixados e cacheados pelo hub (regenerável; não entra no Git).

Edite o `hub.json` e recarregue a página. Se o JSON tiver erro, o app **não quebra**: mostra um aviso com o caminho do problema e usa `hub.json.bak` (o último arquivo válido), quando existir.

O schema e as referências (categoria/grupo inexistente, id duplicado, URL inválida, protocolo inseguro) são validados por Zod em `src/lib/schema.ts`.

### Biblioteca e ícones

A página **Biblioteca** (`/biblioteca`) reúne **links e apps do PC** no mesmo lugar:

- Abas **Todos / Apps do PC / Navegador** e busca local por nome, grupo, categoria ou tag.
- Cada **categoria é um acordeão**: clique no cabeçalho para recolher/expandir. O estado fica salvo no navegador; **Recolher tudo / Expandir tudo** aplica a todas. Ao buscar, as categorias com resultados abrem automaticamente; ao limpar, o estado anterior volta.
- A sidebar mostra, por categoria, **itens · fontes de feed** (ex.: `17 · 3`), com detalhes no tooltip.
- Organização por **categoria → grupo**. Um grupo pode combinar serviços do mesmo assunto (ex.: Darktide = app na Steam + site de builds + wiki + subreddit), e cada item mantém seu `type` (`app` ou `link`).
- Itens sem grupo aparecem em **“Sem grupo”**.
- **Ícones**: links e apps usam `/api/icon?url=...`, que baixa o favicon oficial (`/favicon.ico`, `/favicon.png` ou `apple-touch-icon.png`) via `safe-fetch`, guarda em `data/icons/` e serve do cache nas próximas visitas. Sem DuckDuckGo/Google/Simple Icons no carregamento; se nada for encontrado, aparecem as iniciais.
- **Descrição curta** opcional por item aparece no card da Biblioteca, no tooltip do Acesso rápido e na busca.
- Cada grupo tem uma **página própria** em `/g/<id>` com os links/apps do grupo, o feed das fontes vinculadas e o botão **Abrir tudo** (com confirmação e aviso quando o navegador bloquear pop-ups). O card do grupo na categoria leva para essa página.
- **Mais usados**: os 8 links/apps mais abertos aparecem no topo da Biblioteca, com **Limpar histórico** (confirmação). A home mostra os 5 **Recentes** na barra lateral. Só contagens e datas ficam em `data/usage.json`; nada sai da máquina.
- O campo opcional `icon` sobrescreve o ícone com uma URL `https://...` (também passa pelo cache local). Slugs antigos do Simple Icons não são mais buscados e caem para o favicon do item/iniciais.
- A rota antiga `/apps` redireciona para `/biblioteca`.

### Tags

- A **Biblioteca** mostra uma linha de chips com as tags e a contagem de itens.
- Clicar em uma tag filtra a lista; o filtro combina com busca, abas de tipo e categorias.
- A URL reflete o filtro (`/biblioteca?tag=build`) e sobrevive a reload/compartilhamento.
- Em **Gerenciar → Tags**, renomeie uma tag e ela é atualizada em todos os itens; se o destino já existir, as tags são mescladas. **Remover** tira a tag de todos os itens sem apagar os itens.
- O editor de item sugere as tags já existentes.
- `Build`, `build ` e `BUILD` contam como a mesma tag; a primeira grafia é preservada.
- Detalhes: [docs/tags.md](docs/tags.md).

### Título, notificações e tema

- O título da aba mostra os não lidos (`(3) Meu Hub`) e o favicon ganha um badge com a contagem.
- Notificações de posts novos são **opt-in** (Gerenciar → Aparência), só aparecem com a aba oculta, respeitam a permissão do navegador e nunca notificam posts já lidos. Se a permissão for negada, o próprio card explica como liberar (cadeado → Notificações → Permitir) e mostra o aviso em vermelho, não como sucesso.
- Cores de estado (hover, sucesso, perigo) vêm de tokens em `:root`; componentes não usam mais `font-size` inline (exceto o ícone dimensionado por prop).

### Mobile e preferências de leitura

- Abaixo de 900 px a navegação vira **drawer**: o menu abre pelo botão ☰, fecha ao navegar, no backdrop ou com Esc, e não ocupa a primeira tela.
- Em **Gerenciar → Aparência** há densidade (confortável/compacta), tamanho do texto (13/14/15 px), contraste alto e **layout da home** (empilhado/dividido); tudo fica salvo no `hub.json` e vale para todas as telas.

### Busca, comandos e notas

- `Ctrl+K` abre a palette: pesquisa links, apps, categorias, fontes, posts, notas e comandos.
- Operadores: `>texto` só comandos, `tag:build`, `source:rss`, `is:unread` e `is:saved`.
- Comandos prontos: adicionar link/fonte/categoria, abrir Gerenciar/Biblioteca/Salvos, exportar os dados e atualizar o feed (com progresso).
- A **Nota rápida** da home fica em `data/notes.json` (não no navegador), entra no export/import e sobrevive a limpar o navegador.
- O **Acesso rápido** respeita `settings.quickAccessOrder`; arraste para reordenar ou use ↑/↓ no modo _Reordenar_, fixe/desafixe itens e **grupos** direto na Biblioteca, e resolva o excedente no próprio modo de edição (seção “Fora do acesso rápido”).
- No editor de fonte, **Testar** mostra quantos posts chegam, quantos passam nas regras e os primeiros títulos, sem gravar no cache.

### Feed (M3)

- Busca automática a cada ~60 s apenas nas fontes cujo intervalo venceu, e também pelo botão **Atualizar agora** (home, categoria, feed e Gerenciar).
- Tipos de fonte: **RSS/Atom** (URL direta), **Reddit** (nome do subreddit ou URL do `.rss`) e **YouTube** (`@handle`, URL do canal, ID `UC...` ou URL `feeds/videos.xml?channel_id=...`).
- Reddit usa `https://www.reddit.com/r/<sub>/.rss` (o alias antigo `/new.rss` é bloqueado com 429) e um User-Agent no formato que a política deles aceita; se o site limitar, o status mostra “429” com instrução de tentar em alguns minutos.
- Cada fonte tem intervalo próprio e **limite de posts** (10/20/30/50/100; padrão 30), além de poder ser atualizada individualmente em **Gerenciar → Fontes**.
- Regras por fonte: `include`/`exclude` e `matchMode` (`any`/`all`), aplicadas sobre título + resumo, sem diferenciar maiúsculas nem acentos. Uma fonte com erro não derruba as outras; o status aparece em **Gerenciar** e em **Feed completo**.
- Filtro ao vivo no **Feed completo** e na categoria: palavra-chave, alternância qualquer/todas, filtros salvos com contagem, chips de categoria e de fonte com não lidos, "Não lidos" e destaque do trecho encontrado.
- **+ Salvar filtro** captura a busca atual num formulário em linha com **Nome, Incluir, Excluir, Modo, Categoria, Fonte e "Somente não lidos"**. Os filtros podem ser editados/removidos em Gerenciar → Regras.
- **Marcar antigos** permite marcar como lido o que está na visão atual com mais de 1, 3 ou 7 dias, com desfazer por 30 segundos.
- O contador de não lidos da sidebar usa a mesma visão do feed (ignora fontes removidas/desligadas); cache de fonte removida é limpo ao carregar.
- **Selecionar** entra no modo de seleção: clique em qualquer lugar do card (ou no checkbox) para alternar, shift+clique redefine o intervalo (desmarcando quem ficou fora), e barra de ações em lote (lido/não lido, salvar/remover, selecionar todos).
- Atalhos no feed: `j`/`k` navegam, `m` marca lido, `s` salva, `o`/`Enter` abrem, `?` mostra a ajuda e `Esc` sai da seleção.
- O **Acesso rápido** fica no card de mesmo nome no topo da home: **9 atalhos fixos** (itens e grupos) em grade adaptativa — 3 colunas no layout empilhado, 2 no dividido —, com reordenação por arrastar ou ↑/↓ sem alterar a altura do card.
- Um **grupo fixado** aparece como atalho “Grupo · N itens” e abre a **Biblioteca já focada** naquele grupo (`/biblioteca?grupo=...`), expandindo a categoria e destacando o grupo.
- Quando há mais fixados que o limite, o excedente aparece no modo **Reordenar** em “Fora do acesso rápido”, com ↑ para trazer de volta e ✕ para desafixar.
- Ações por post: **Abrir**, **Salvar para depois** e **Marcar como lido** — exibidas como ícones (link externo, bookmark e check), com tooltip e `aria-label`. Os posts salvos aparecem em **Salvos** (rota `/favoritos`); o contador da sidebar mostra não lidos. Ao salvar, um snapshot do post é guardado, então ele continua em Salvos mesmo se a fonte for removida ou o cache expirar.
- **Vídeos do YouTube**: a thumbnail mostra um botão **▶**; o clique abre um player em modal com `youtube-nocookie` e autoplay, sem alterar o layout do Bento. O modal fecha por Esc, botão fechar ou clique fora e tem o atalho **Abrir no YouTube**.
- **Mídia do Reddit**: a thumbnail com selo **R** abre o **lightbox** com a imagem cheia (`i.redd.it`); dali, **“Ver no player”** (só quando a capa é `external-preview.redd.it`, caso típico de vídeo) abre o **embed oficial** (`embed.reddit.com`), com “Abrir no Reddit” como fallback. As prévias `preview.redd.it` do RSS (muitas vezes 140 px) são trocadas pela imagem cheia nos cards e no lightbox, com fallback para a prévia. Posts só de texto não mostram bloco de imagem. O embed usa o idioma do navegador/conta.
- **Imagens do feed**: thumbnails que não são vídeo abrem um **lightbox** com a imagem, título e atalhos **Abrir imagem** e **Abrir publicação**; não é mais necessário sair do hub só para ver a imagem.
- **Visualizações**: **Bento** (masonry em colunas iguais: 2 colunas, 3 quando o feed está largo, imagens 3:2 e retrato adaptativo), **Compacto** (imagem ou placeholder com o nome da fonte, meta, título e ações; sem excerpt) e **Completo** (lista com imagem lateral maior e texto expansível). A escolha fica salva no navegador.
- No Bento o texto flui naturalmente (sem corte de linhas) e o masonry posiciona cada card na coluna mais curta, sem buracos.
- Cards filtrados/marcados como lidos desaparecem com fade e os restantes deslizam para a nova posição. **Ao entrar/trocar de página ou trocar de visualização não há animação**; ela só é ativada após o feed assentar (~400ms) e passa a valer para filtros, busca, lidos e “Carregar mais”. Respeita `prefers-reduced-motion`.
- A **home é o centro do fluxo**: linha de status (não lidos, última atualização e erro só quando existe), **Acesso rápido** (9 atalhos) e **Ferramentas** no topo, e as **5 últimas notícias** em largura total. Em Gerenciar → Aparência dá para trocar para o **layout dividido** (atalhos 1/3 com Ferramentas abaixo, ao lado do feed 2/3; a barra direita desce em telas menores que 1600 px). Os filtros completos ficam no Feed.
- A barra superior usa uma **busca compacta** que abre a palette (`Ctrl K`) em vez de um campo falso; na home ela mostra o título **Início** e uma única ação **Adicionar**, sem duplicar o botão Editar.
- A barra direita é fixa/sticky e mostra Fontes do feed, Filtros salvos, Recentes, Salvos recentemente e Nota rápida. A sidebar esquerda é fixa, com rodapé fixo e engrenagem no topo.
- Imagens vêm de `media:*`, `enclosure`, do primeiro `<img>` do conteúdo e, para YouTube, do ID do vídeo.
- Cache: até 30 posts por fonte, retenção de 30 dias, deduplicação por URL/guid. Requisições com timeout de 10 s, User-Agent identificado e limite de 5 MB por resposta.

> Observações: o feed RSS do Reddit pode sofrer rate limit (429) — o erro fica visível e a fonte tenta de novo no próximo intervalo. Para YouTube, o hub aceita `@handle`, URL do canal ou ID `UC...` e resolve o ID automaticamente.

### Salvos (busca por título ou conteúdo)

- A página **Salvos** (`/favoritos`) lista os posts salvos com busca por **título** (padrão: título, resumo e fonte) ou por **conteúdo**, pelo alternador **Título / Conteúdo**; a escolha fica no navegador.
- No topo, uma faixa mostra **salvos, lidos, arquivados, destaques e tempo estimado de leitura** (200 palavras por minuto), calculada localmente; o tooltip explica quantos salvos já têm texto extraído.
- No modo conteúdo, a busca cobre o texto extraído pelo reader e **todos** os destaques e notas, inclusive de posts não salvos (seção “Destaques fora dos salvos”). Cada trecho aparece com o termo marcado e o título abre `/ler/<id>`.
- A consulta exige todos os termos, ignora acento/caixa e mostra a cobertura (“N de M salvos com texto”) para explicar uma busca vazia. Só encontra conteúdo já extraído.
- **Ordenar: Salvamento / Publicação** reordena a lista (e os resultados de conteúdo) pela data em que você salvou ou pela data original do post.
- O contador “Mostrando X de Y” sai com slide horizontal ao trocar para Conteúdo, empurrando os chips sem salto; `prefers-reduced-motion` desliga a animação.

### Reader e destaques

- Em **Gerenciar → Fontes**, fontes RSS têm **Buscar texto completo (reader)** (padrão desligado). O botão **Ler aqui** no card abre `/ler/<id>`.
- O reader busca a página com as mesmas proteções do feed (SSRF, timeout e limite de 5 MB), extrai o conteúdo principal com Readability, sanitiza o HTML e guarda em `data/reading/<id>.json`. A próxima abertura é servida do cache, inclusive offline.
- Se a extração falhar, o reader mostra o motivo e mantém **Abrir original**. YouTube e Reddit não têm reader.
- **Destaques**: selecione um trecho no reader e escolha uma cor ou **Anotar**. O trecho e a nota ficam em `data/highlights.json` e aparecem no fim do artigo e em **Destaques** (`/highlights`), com busca por trecho, nota ou título e **filtro por cor** (Todas/amarelo/verde/azul/rosa, com contagem).
- Limites: HTML sanitizado de até 2 MB, texto de até 200 mil caracteres (truncado, com tamanho original preservado), 300 artigos e trechos/notas de até 2.000 caracteres. Destaques entram no export/import; os artigos extraídos ficam só na máquina.

### Arquivo/offline do salvo

- Ao **salvar** um post de fonte RSS, o hub arquiva automaticamente a página inteira (HTML sanitizado + imagens) em `data/archive/<id>/`; o status aparece em **Salvos/reader** e em **Gerenciar → Backups → Leitura arquivada**.
- O arquivo abre em `/arquivo/<id>` como página de topo, com CSP restrita (`script-src 'none'`, imagens só locais) e CSS próprio. Funciona offline e depois de a URL original sair do ar.
- “Arquivar agora” cria a cópia de um post já salvo; “Remover arquivo” apaga a cópia e mantém o post/snapshot. Dessalvar também apaga o arquivo. Importar/restaurar não apaga arquivos automaticamente.
- SEO/privacidade: a cópia é local, sem scripts e sem requisições externas ao abrir. Limites: 5 MB de HTML por página, 3 MB sanitizado, 20 imagens de até 2 MB (20 MB no total), 200 arquivos e 500 MB no total; ao atingir o teto, novos arquivamentos falham com aviso para remover em Gerenciar.

### Exportar e importar

Na tela **Gerenciar**:

- **Exportar dados** baixa um `hub-export-AAAA-MM-DD.json` com o hub e o estado.
- **Exportar salvos em Markdown** (Gerenciar → Backups) baixa `meu-hub-export-AAAA-MM-DD.zip` com `index.md` + um `.md` por post salvo ou destacado: frontmatter (URL, datas, tags), resumo, links e destaques.
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

### Saúde dos links e duplicados

- **Verificar links** (Gerenciar → Itens) usa `fetchPublicText` com 1 MB, 8 s por link e concorrência 4; o resultado fica em `data/link-status.json` e aparece como contador e badge por linha.
- Estados: `ok`, `redirect` (com o destino no tooltip), `broken` (4xx), `timeout` e `error` (5xx/rede). Um link com problema não impede os demais.
- **Duplicados** comparam URLs ignorando caixa do host, `www`, barra final, hash, `utm_*`/`fbclid`/`gclid` e ordem da query; caminhos diferentes continuam distintos. O painel lista as cópias e permite remover com confirmação.

### Editar pela interface (M4)

Em **Gerenciar**, as abas são funcionais:

- **Fontes do feed**: adicionar, editar, remover, ligar/desligar, **atualizar só uma fonte** e buscar por nome/alvo/grupo/categoria. Status de cada fonte. Para Reddit, um interruptor **Exibir em inglês** define `locale=en`; desligado usa o idioma do navegador.
- **Itens**: links e apps juntos, com subchips **Todos / Links / Apps**, busca local e agrupamento por **categoria → grupo** (inclui “Sem grupo”). Adicionar link e adicionar app ficam no cabeçalho. **Verificar links** roda em paralelo (4 por vez), marca **quebrado/redireciona** por linha e agrupa **duplicados** por URL normalizada, com botão para remover as cópias.
- **Grupos**: criar, renomear, mover de categoria, reordenar (↑/↓) e remover (bloqueia se tiver itens ou fontes).
- **Categorias**: adicionar, renomear/cor, reordenar (↑/↓) e remover (bloqueia se estiver em uso). Mostra itens, grupos e fontes.
- **Filtros salvos**: adicionar/editar/remover filtros de busca, com Incluir, Excluir, Modo, Categoria, Fonte e “Somente não lidos”.
- **Backups**: criar, listar, baixar, restaurar e excluir pontos de restauração (hub, estado, cache, notas e destaques); mostra a idade do último backup automático. O **Backup completo (ZIP)** baixa os JSONs + `reading/` (+ `archive/` opcional) com um `manifest.json`.
- **Aparência**: escolher a cor de destaque do tema (predefinidas ou cor personalizada).

O editor lateral é compacto, dividido em seções (**Fonte/Organização/Atualização/Filtros**, **Identificação/Organização/Aparência/Extras**), com cabeçalho e rodapé fixos — os botões **Cancelar/Salvar** ficam sempre visíveis. A remoção usa um diálogo próprio, no tema escuro, em vez do `confirm()` do navegador.

O botão **Adicionar** abre um painel lateral com formulário específico. Para fontes RSS, o botão **Detectar** procura automaticamente o feed na página informada. Toda alteração é validada pelo Zod e gravada no `hub.json` de forma atômica, com backup `.bak`.

### Uso em uma máquina só

O hub foi desenhado para uma única máquina, com `data/` local. O lock de escrita é por processo (cobre abas e jobs do mesmo servidor) e **não há detecção de conflito entre PCs**. Não use a mesma pasta em OneDrive/Drive com dois computadores ao mesmo tempo: a última gravação vence. Para trocar de PC, use **Gerenciar → Exportar** e **Importar**.

## Telas

| Rota                  | Tela                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `/`                   | Início: status, acesso rápido (9 atalhos/grupos), ferramentas, 5 últimas notícias e painel direito       |
| `/c/[slug]`           | Categoria: grupos, links/apps e feed restrito à categoria                                                |
| `/g/[slug]`           | Grupo: links/apps, feed das fontes do grupo e “Abrir tudo”                                               |
| `/feed`               | Feed completo com filtros e fontes cadastradas                                                           |
| `/favoritos`          | Salvos: estatísticas, posts para depois, busca por título/conteúdo e ordenação por salvamento/publicação |
| `/biblioteca`         | Biblioteca: abas Todos/PC/Navegador, busca, categorias → grupos → links/apps                             |
| `/apps`               | Redireciona para `/biblioteca`                                                                           |
| `/gerenciar`          | Fontes/links/apps/grupos, edição, status do feed, exportar/importar                                      |
| `/api/hub`            | JSON do hub validado (GET) e mutações validadas (POST)                                                   |
| `/api/export`         | Download do bundle (hub + estado)                                                                        |
| `/api/backup/zip`     | Backup completo em ZIP (JSONs + `reading/`; `?arquivos=1` inclui `archive/`)                             |
| `/api/links/health`   | Status da última verificação (GET) e verificação dos links do hub (POST)                                 |
| `/api/icon`           | Favicon em cache local (`?url=`), com fallback 404 para as iniciais                                      |
| `/api/usage`          | Registra abertura (POST), lê o histórico (GET) e limpa (DELETE)                                          |
| `/api/import`         | Importação validada (substituir/mesclar)                                                                 |
| `/api/feed`           | Cache do feed com status por fonte                                                                       |
| `/api/refresh`        | Dispara a atualização de todas as fontes (`async: true` devolve um job com progresso)                    |
| `/api/refresh/status` | Progresso de um job de atualização (`?id=`)                                                              |
| `/api/state`          | Lidos/salvos (GET) e ações como read/save/mark-all-read (POST)                                           |
| `/api/search/content` | Busca no texto extraído dos salvos e nos destaques (`?q=&limit=&sort=`)                                  |
| `/api/discover-feed`  | Descobre o feed RSS/Atom de uma página (POST)                                                            |

## Segurança e privacidade

- Todo tráfego é local (`127.0.0.1`); `Host`/`Origin` de outros domínios são bloqueados com 403.
- `Content-Security-Policy` roda em **enforce** (não Report-Only): `default-src 'self'`, scripts e estilos próprios, `object-src 'none'`, `frame-ancestors 'none'`. Players liberados apenas para `youtube-nocookie.com` e `redditmedia.com`.
- Fontes (Inter/Space Grotesk) são servidas de `static/fonts`; não há requisição a Google Fonts.
- Toda imagem externa usa `referrerpolicy="no-referrer"`.
- URLs de feed/imagem só são aceitas em `http(s)`; o fetch valida o IP resolvido e bloqueia rede interna (SSRF).
- `/api/health` mostra contagens, permissão de escrita e idade do feed sem expor token ou conteúdo.
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
    reader/               # reader, destaques e busca no conteúdo dos salvos
    text/                 # normalização sem acento e trechos de busca
    export/               # export Markdown
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
npm run test:e2e        # Playwright: fluxos reais + axe (precisa de build e Chromium)
npm run test:e2e:report # abre o relatório HTML do Playwright
```

O `test:e2e` sobe o build em `127.0.0.1:5760` com um diretório de dados descartável (`.e2e-data/`). A suíte tem **54 testes**: fluxos de produto (adicionar link, salvar/desfavoritar post, busca por título e por conteúdo, destaque fora dos salvos, filtro por cor em Destaques, estatísticas de leitura em Salvos, links quebrados/duplicados, backup em ZIP, página de grupo + abrir tudo, recentes/mais usados + limpar histórico, marcar tudo como lido com desfazer, nota rápida, palette com busca e comando, ações rápidas da home, mobile 375 px) e axe nas telas principais (`/`, `/feed`, `/biblioteca`, `/gerenciar`, `/favoritos`, `/ler/[id]`, `/highlights` e `/arquivo/[id]`). O `verify` também roda `check:e2e` (type-check dos testes). A suíte é hermética: fontes de feed ficam desligadas no fixture e requisições externas são bloqueadas. O workflow em `.github/workflows/ci.yml` roda `check`, `lint`, `test`, `build` e depois `test:e2e` com Chromium em cada push/PR para `master`.

`npm audit --omit=dev` não encontra vulnerabilidades de runtime. Os avisos restantes do `npm audit` são de dependências de desenvolvimento (ESLint) e não afetam o app.

O plano de evolução e as decisões dos sprints ficam em [`PLANO-EXECUCAO.md`](PLANO-EXECUCAO.md), [`docs/sprint-0.md`](docs/sprint-0.md), [`docs/sprint-1.md`](docs/sprint-1.md), [`docs/security.md`](docs/security.md), [`docs/data.md`](docs/data.md), [`docs/triage.md`](docs/triage.md), [`docs/bulk.md`](docs/bulk.md), [`docs/performance.md`](docs/performance.md) e [`docs/checklist-regressao.md`](docs/checklist-regressao.md).

### Performance

- O feed renderiza **10 cards** por vez e usa “Carregar mais”; o masonry só posiciona o que está visível.
- Com **1.000 posts** sintéticos, `buildFeedView` fica em ~4,5 ms, o filtro em ~2,1 ms e a busca Fuse em <1 ms; o payload do cache fica em 256 KB. O teste `src/lib/perf/feed-1000.test.ts` roda no `npm test` e falha se estourar os orçamentos.
- Não há virtualização nem SQLite nesta fase: o critério (>5.000 posts, >500 itens, full-text ou múltiplos processos) está longe. Detalhes e quando revisitar: [`docs/performance.md`](docs/performance.md).

## Mockups

Os arquivos em `mockups/` são referências visuais exportadas de ferramenta de design (rodam com React via `support.js`). Para vê-los:

```powershell
python -m http.server 8000
# http://localhost:8000/mockups/Main.dc.html
# http://localhost:8000/mockups/Categoria.dc.html
# http://localhost:8000/mockups/Gerenciar.dc.html
```

Eles não fazem parte do build do app.

### Limites e decisões técnicas

- Apps abrem apenas por protocolo (`steam://`, `discord://`, `vscode://`...). `javascript:`, `data:`, `vbscript:` e `file:` são rejeitados; execução de comandos não existe nesta versão.
- `estado.json` e `feed-cache.json` são validados por Zod; arquivo inválido tenta `.bak` e avisa no layout.
- APIs têm limite de corpo: 2 MB em hub/state, 10 MB em import e 64 KB nas APIs pequenas; excesso retorna 413.
- O refresh usa fetch seguro (timeout, 5 MB, bloqueio de loopback/IP privado e redirects revalidados) e é coalescido entre scheduler e botão.
- Escritas usam lock por processo + gravação atômica com retry para `EPERM`/`EBUSY`; hub e cache de uma fonte são atualizados na mesma transação.
- Backups automáticos mantêm `.bak` + 6 gerações; pontos manuais incluem hub, estado, cache, notas e destaques. O ZIP completo inclui `reading/` e, opcionalmente, `archive/`.
- Ícones são baixados uma vez e servidos de `data/icons/`; thumbnails de feed continuam diretas com `no-referrer` (sem proxy genérico nesta versão).
- POST/DELETE enviam `content-type: application/json`; o CSRF do SvelteKit bloqueia formulário/vazio com 403. A importação mostra diff e política de settings.
- `estado.json` poda leituras com mais de 90 dias (exceto salvos) e snapshots órfãos.
- Sem login, sem versão online e sem tema claro. Escrita de links/fontes é validada e restrita ao `hub.json`.
- Assets estáticos (`/fonts/*`, `/_app/*`) saem antes do `hooks.server`; os headers de segurança cobrem HTML e APIs (ver `docs/security.md`).
- **Não suportado:** dois PCs na mesma pasta, SQLite (critério não atingido) e proxy genérico de thumbnail/`HTTPS_PROXY` automático.

### Descobrir o protocolo de um app (Windows)

1. Teste o esquema no Executar (`Win+R`): `steam://`, `discord://`, `vscode://`, `obsidian://`, `spotify://`, `ms-word:`.
2. No Editor do Registro, procure `HKEY_CLASSES_ROOT\<esquema>` para ver o handler instalado.
3. Muitos apps expõem o esquema em "criar atalho" ou na documentação; use o texto antes de `://` (ou antes de `:` em `ms-word:`).

### Rede do trabalho e proxy

O servidor busca RSS/YouTube/Reddit diretamente. Se a rede do trabalho exigir proxy, o `fetch` do Node não usa `HTTPS_PROXY` automaticamente; nesse caso use VPN ou configure o proxy no nível do sistema/rede. Para diagnosticar, use **Gerenciar → Atualizar agora** e veja o erro de cada fonte.

## Contribuindo

Este é um projeto pessoal e **local-first**. Issues com passos de reprodução e sugestões são bem-vindas; não há garantia de prazo para PRs. Antes de abrir um PR:

1. Rode `npm run verify` (check + lint + testes + build).
2. Mantenha o escopo pequeno e um commit por mudança.
3. Nunca inclua `data/*.json`, `.env` ou dados pessoais.

## Licença

Projeto pessoal, sem licença de distribuição definida. Se quiser reutilizar o código, abra uma issue para conversarmos. Para publicar como open source, o passo natural é adicionar um `LICENSE` (por exemplo, MIT).
