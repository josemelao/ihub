# Meu Hub

Hub pessoal local (página inicial do navegador) com links, apps do PC e um feed por palavra-chave. Roda apenas no seu computador, em `localhost`.

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
- `data/estado.json` — lidos/salvos (criado quando necessário; não entra no Git).
- `data/feed-cache.json` — posts já buscados e status por fonte (regenerável; não entra no Git).

Edite o `hub.json` e recarregue a página. Se o JSON tiver erro, o app **não quebra**: mostra um aviso com o caminho do problema e usa `hub.json.bak` (o último arquivo válido), quando existir.

O schema e as referências (categoria/grupo inexistente, id duplicado, URL inválida, protocolo inseguro) são validados por Zod em `src/lib/schema.ts`.

### Feed (M3)

- Busca automática a cada ~60 s apenas nas fontes cujo intervalo venceu, e também pelo botão **Atualizar agora** (home, categoria, feed e Gerenciar).
- Tipos de fonte: **RSS/Atom** (URL direta), **Reddit** (nome do subreddit ou URL do `.rss`) e **YouTube** (ID do canal `UC...` ou URL `feeds/videos.xml?channel_id=...`).
- Regras por fonte: `include`/`exclude` e `matchMode` (`any`/`all`), aplicadas sobre título + resumo, sem diferenciar maiúsculas nem acentos. Uma fonte com erro não derruba as outras; o status aparece em **Gerenciar** e em **Feed completo**.
- Filtro ao vivo na home e na categoria: palavra-chave, alternância qualquer/todas, filtros salvos com contagem, chips de categoria, "Não lidos" e destaque do trecho encontrado.
- Ações por post: **Abrir**, **Salvar para depois** e **Marcar como lido**. Os posts salvos aparecem em **Favoritos**; o contador da sidebar mostra não lidos.
- **Visualizações**: **Bento** (2 colunas, cards com imagem ocupam a largura toda e os de texto se encaixam), **Compacto** (lista) e **Grade** (cards uniformes). A escolha fica salva no navegador.
- Na home, o painel **Fontes do feed / Nota rápida** pode ser recolhido para dar mais largura ao feed.
- Imagens vêm de `media:*`, `enclosure`, do primeiro `<img>` do conteúdo e, para YouTube, do ID do vídeo.
- Cache: até 30 posts por fonte, retenção de 30 dias, deduplicação por URL/guid. Requisições com timeout de 10 s, User-Agent identificado e limite de 5 MB por resposta.

> Observações: o feed RSS do Reddit pode sofrer rate limit (429) — o erro fica visível e a fonte tenta de novo no próximo intervalo. Para YouTube, é necessário o ID do canal; URLs `@handle` não são resolvidas automaticamente nesta versão.

### Exportar e importar

Na tela **Gerenciar**:

- **Exportar dados** baixa um `hub-export-AAAA-MM-DD.json` com o hub e o estado.
- **Importar dados** lê o arquivo, valida e mostra um resumo antes de confirmar. Escolha **substituir tudo** ou **mesclar por id**. Um backup do `hub.json` atual é criado automaticamente.

### Editar pela interface (M4)

Em **Gerenciar**, as abas são funcionais:

- **Fontes do feed**: adicionar, editar, remover e ligar/desligar; status de cada fonte.
- **Links** e **Apps do PC**: adicionar, editar, remover e reordenar (↑/↓).
- **Categorias**: adicionar, renomear/cor, reordenar (↑/↓) e remover (bloqueia se estiver em uso).
- **Regras do feed**: adicionar/remover filtros salvos.

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

| Rota                 | Tela                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `/`                  | Início: busca (Ctrl K), acesso rápido, feed com filtros, fontes e nota rápida |
| `/c/[slug]`          | Categoria: grupos, links/apps e feed restrito à categoria                     |
| `/feed`              | Feed completo com filtros e fontes cadastradas                                |
| `/favoritos`         | Atalhos fixados, filtros salvos e posts salvos                                |
| `/apps`              | Apps do PC por categoria (abrem por protocolo)                                |
| `/gerenciar`         | Fontes/links/apps, edição, status do feed, exportar/importar                  |
| `/api/hub`           | JSON do hub validado (GET) e mutações validadas (POST)                        |
| `/api/export`        | Download do bundle (hub + estado)                                             |
| `/api/import`        | Importação validada (substituir/mesclar)                                      |
| `/api/feed`          | Cache do feed com status por fonte                                            |
| `/api/refresh`       | Dispara a atualização de todas as fontes                                      |
| `/api/state`         | Lidos/salvos (GET) e ações como read/save/mark-all-read (POST)                |
| `/api/discover-feed` | Descobre o feed RSS/Atom de uma página (POST)                                 |

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
