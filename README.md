# Meu Hub

Hub pessoal local (página inicial do navegador) com links, apps do PC e um feed por palavra-chave. Roda apenas no seu computador, em `localhost`.

> Handoff técnico (o que foi feito, como e pendências): [HANDOFF.md](HANDOFF.md).

## Status

- **M0 (projeto)**, **M1 (dados e layout)**, **M2 (busca Ctrl K, exportar/importar)**, **M3 (feed)**, **M4 (painel de edição)** e **M5 (acabamento)**: concluídos.
- Os dados iniciais vêm dos mockups de referência (categorias, grupos, atalhos fixados, fontes e filtros salvos).

## Stack

SvelteKit 3 + Svelte 5 (runes) + TypeScript, `@sveltejs/adapter-node`, Vitest, Zod, Fuse.js, `fast-xml-parser` e adapter-node. Tema escuro único, responsivo.

## Como rodar

Requisitos: Node.js 24+ e npm.

```powershell
npm install
Copy-Item data\hub.example.json data\hub.json   # só na primeira vez
npm run dev
```

Abre em <http://127.0.0.1:5757>.

Para uso diário (build de produção):

```powershell
npm run build
npm start
```

`npm start` força `HOST=127.0.0.1` e `PORT=5757` por padrão. Variáveis aceitas (veja `.env.example`):

| Variável       | Padrão      | Função                                                    |
| -------------- | ----------- | --------------------------------------------------------- |
| `HOST`         | `127.0.0.1` | interface de rede (não exponha na rede)                   |
| `PORT`         | `5757`      | porta                                                     |
| `HUB_DATA_DIR` | `data`      | pasta dos arquivos JSON (pode ser uma pasta sincronizada) |

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

### Feed (M3)

- Busca automática a cada ~60 s apenas nas fontes cujo intervalo venceu, e também pelo botão **Atualizar agora** (home, categoria, feed e Gerenciar).
- Tipos de fonte: **RSS/Atom** (URL direta), **Reddit** (nome do subreddit ou URL do `.rss`) e **YouTube** (`@handle`, URL do canal, ID `UC...` ou URL `feeds/videos.xml?channel_id=...`).
- Cada fonte tem intervalo próprio e **limite de posts** (10/20/30/50/100; padrão 30), além de poder ser atualizada individualmente em **Gerenciar → Fontes**.
- Regras por fonte: `include`/`exclude` e `matchMode` (`any`/`all`), aplicadas sobre título + resumo, sem diferenciar maiúsculas nem acentos. Uma fonte com erro não derruba as outras; o status aparece em **Gerenciar** e em **Feed completo**.
- Filtro ao vivo no **Feed completo** e na categoria: palavra-chave, alternância qualquer/todas, filtros salvos com contagem, chips de categoria, "Não lidos" e destaque do trecho encontrado.
- **+ Salvar filtro** captura a busca atual num formulário em linha com **Nome, Incluir, Excluir e Modo (qualquer/todas)**. Os filtros podem ser editados/removidos em Gerenciar → Regras.
- A **Acesso rápido** fica no card de mesmo nome no topo da home (grade compacta, até 6 atalhos).
- Ações por post: **Abrir**, **Salvar para depois** e **Marcar como lido** — exibidas como ícones (link externo, bookmark e check), com tooltip e `aria-label`. Os posts salvos aparecem em **Favoritos**; o contador da sidebar mostra não lidos. Ao salvar, um snapshot do post é guardado, então ele continua em Favoritos mesmo se a fonte for removida ou o cache expirar.
- **Vídeos do YouTube**: a thumbnail mostra um botão **▶**; o clique abre um player em modal com `youtube-nocookie` e autoplay, sem alterar o layout do Bento. O modal fecha por Esc, botão fechar ou clique fora e tem o atalho **Abrir no YouTube**.
- **Vídeos do Reddit**: a thumbnail mostra um selo **Reddit**; ao clicar, o hub consulta o embed oficial e detecta se o post é vídeo. Se for, abre o player do Reddit em modal; se não, mantém o lightbox de imagem. O resultado fica em cache por 10 minutos. Não há scraping do JSON nem extração de MP4/HLS.
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

### Editar pela interface (M4)

Em **Gerenciar**, as abas são funcionais:

- **Fontes do feed**: adicionar, editar, remover, ligar/desligar, **atualizar só uma fonte** e buscar por nome/alvo/grupo/categoria. Status de cada fonte.
- **Itens**: links e apps juntos, com subchips **Todos / Links / Apps**, busca local e agrupamento por **categoria → grupo** (inclui “Sem grupo”). Adicionar link e adicionar app ficam no cabeçalho.
- **Grupos**: criar, renomear, mover de categoria, reordenar (↑/↓) e remover (bloqueia se tiver itens ou fontes).
- **Categorias**: adicionar, renomear/cor, reordenar (↑/↓) e remover (bloqueia se estiver em uso). Mostra itens, grupos e fontes.
- **Filtros salvos**: adicionar/editar/remover filtros de busca, com Incluir, Excluir e Modo.
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

| Rota                 | Tela                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `/`                  | Início: painel geral, 5 últimas notícias, acesso rápido, resumo, ações e painel direito |
| `/c/[slug]`          | Categoria: grupos, links/apps e feed restrito à categoria                               |
| `/feed`              | Feed completo com filtros e fontes cadastradas                                          |
| `/favoritos`         | Posts salvos para depois, com busca e ordenação por salvos/publicados                   |
| `/biblioteca`        | Biblioteca: abas Todos/PC/Navegador, busca, categorias → grupos → links/apps            |
| `/apps`              | Redireciona para `/biblioteca`                                                          |
| `/gerenciar`         | Fontes/links/apps/grupos, edição, status do feed, exportar/importar                     |
| `/api/hub`           | JSON do hub validado (GET) e mutações validadas (POST)                                  |
| `/api/export`        | Download do bundle (hub + estado)                                                       |
| `/api/import`        | Importação validada (substituir/mesclar)                                                |
| `/api/feed`          | Cache do feed com status por fonte                                                      |
| `/api/refresh`       | Dispara a atualização de todas as fontes                                                |
| `/api/state`         | Lidos/salvos (GET) e ações como read/save/mark-all-read (POST)                          |
| `/api/discover-feed` | Descobre o feed RSS/Atom de uma página (POST)                                           |

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

## Qualidade

```powershell
npm test        # Vitest (schema, storage, helpers, edição, feed e seed)
npm run check   # svelte-check
npm run lint    # Prettier + ESLint
```

`npm audit --omit=dev` não encontra vulnerabilidades de runtime. Os avisos restantes do `npm audit` são de dependências de desenvolvimento (ESLint) e não afetam o app.

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
- O feed só busca as fontes cadastradas no `hub.json`, com timeout, User-Agent identificado e limite de tamanho.
- Sem login, sem versão online, sem tema claro.
- Escrita de links/fontes pela interface é validada e restrita ao `hub.json`.
- O descobridor de feeds só acessa `http(s)` públicos (bloqueia loopback/redes privadas) e limita o tamanho da resposta.

### Descobrir o protocolo de um app (Windows)

1. Teste o esquema no Executar (`Win+R`): `steam://`, `discord://`, `vscode://`, `obsidian://`, `spotify://`, `ms-word:`.
2. No Editor do Registro, procure `HKEY_CLASSES_ROOT\<esquema>` para ver o handler instalado.
3. Muitos apps expõem o esquema em "criar atalho" ou na documentação; use o texto antes de `://` (ou antes de `:` em `ms-word:`).

### Rede do trabalho e proxy

O servidor busca RSS/YouTube/Reddit diretamente. Se a rede do trabalho exigir proxy, o `fetch` do Node não usa `HTTPS_PROXY` automaticamente; nesse caso use VPN ou configure o proxy no nível do sistema/rede. Para diagnosticar, use **Gerenciar → Atualizar agora** e veja o erro de cada fonte.
