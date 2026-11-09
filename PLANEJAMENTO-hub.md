# Hub Pessoal: planejamento para implementação

> Documento de handoff para o agente que vai implementar. Reúne tudo o que foi decidido com o dono do projeto (Zé) até aqui. Onde algo estiver marcado como **[sugestão]**, é uma proposta ainda não confirmada e pode ser ajustada. Itens marcados **[validar]** precisam ser testados antes de se apostar neles.

---

## 1. Resumo

Um **hub pessoal** que roda no navegador como página inicial. Ele concentra:

1. **Links** (sites, wikis, ferramentas) organizados em categorias e grupos.
2. **Apps do PC** (Steam, Word, Discord...) abertos por atalho.
3. **Feed** estilo timeline/newsletter com novidades de fontes escolhidas (canais do YouTube, subreddits com palavra-chave, RSS de sites de notícias), com **filtro por palavra-chave sempre à mão na home**.
4. **Busca rápida** (Ctrl K) sobre tudo isso.

Uso previsto: **local**, em dois computadores (casa e trabalho), sem versão online por enquanto. Os dados viajam entre os PCs por **exportar/importar** ou por uma **pasta sincronizada** (Google Drive/OneDrive).

---

## 2. Decisões já fechadas

| Tema | Decisão |
|---|---|
| Onde roda | Local (`localhost`) no PC de casa e no PC do trabalho. **Node.js roda nos dois** (confirmado). Sem online na V1. |
| Troca de dados entre PCs | Exportar/importar um JSON **e/ou** apontar os dois PCs para uma pasta sincronizada (caminho configurável). |
| Armazenamento | **Arquivos JSON** agora, com o código preparado para trocar por banco (SQLite/online) depois, por meio de uma camada de storage com interface única. |
| Edição de dados na V1 | O dono edita o JSON na mão (ou pede ao assistente). O **painel de edição** vem depois. |
| Stack | **SvelteKit** (Svelte + Vite) com **adapter-node**; TypeScript. Front-end e servidor no mesmo projeto. |
| Tema | **Somente escuro.** |
| Mobile | Sem versão dedicada. O layout deve ser **responsivo**. No celular seria só um hub de links (apps do PC não se aplicam). |
| Twitter/X | **Fora** por enquanto. |
| Modos de trabalho (abrir vários links/apps de uma vez) | **Fora da V1.** Ideia futura opcional. |
| Fontes do feed | Canais do YouTube; subreddits filtrados por palavra-chave (exemplo-guia: `r/Darktide` + `patch`); RSS de sites de notícias, também com palavras-chave. |
| Filtro por palavra-chave | Recurso central: regra por fonte **e** filtro ao vivo na home com filtros salvos. |
| Abrir apps do PC | V1: por **protocolos** (`steam://`, `discord://` etc.). V2+: servidor local abre apps por uma lista permitida. |
| Futuro desejado | Possível versão online e extensão de Chrome para "salvar no hub". A arquitetura não deve impedir isso. |

---

## 3. Escopo por fase

**V1: base sem feed**
- Layout (sidebar, topo, home, página de categoria), tema escuro, responsivo.
- Dados vindos de `hub.json` (categorias, grupos, links, apps).
- Acesso rápido na home (itens fixados).
- Páginas de categoria com links/apps em grupos.
- Busca Ctrl K (paleta de comandos).
- Apps do PC via protocolo.
- Exportar/importar dados; caminho dos dados configurável.
- Validação do `hub.json` com mensagens de erro claras (o dono edita à mão).

**V2: feed**
- Servidor busca e normaliza as fontes (RSS/Atom, YouTube, Reddit), com cache e atualização periódica.
- Regras por fonte (incluir/excluir palavras).
- Filtro ao vivo na home e nas categorias, filtros salvos, destaque das palavras nos títulos.
- Estado de lido/salvo (`estado.json`).
- Tela "Gerenciar fontes e links" funcional, em modo leitura + exportar/importar. Edição completa vem na V3.

**V3: painel de edição**
- Painel lateral "Adicionar" (aba Link, App do PC, Fonte de feed) e lista de fontes com liga/desliga.
- Detecção automática de feed RSS a partir de uma URL.
- Reordenar, editar e remover itens.

**Futuro (não implementar agora)**: storage em SQLite/online, extensão de Chrome, modos de trabalho, abrir apps por servidor, tema/ajustes extras.

> Observação: o dono aceitou "feed na V2", mas considera o feed a parte mais importante da home. Recomenda-se que o marco do feed (M3) venha logo depois da base.

---

## 4. Arquitetura

### 4.1 Stack
- **SvelteKit** + **TypeScript**, `@sveltejs/adapter-node`.
- **Fuse.js** para a busca fuzzy (Ctrl K).
- **Zod** para validar `hub.json`/`estado.json`.
- Feed (V2): `fast-xml-parser` (ou `rss-parser`) para RSS/Atom; `fetch` nativo do Node.
- Testes: **Vitest** para lógica pura (filtros, normalização, validação, storage).
- Porta padrão **[sugestão]**: `5757` (configurável por variável de ambiente).

### 4.2 Camada de storage (ponto-chave para o futuro banco)
Toda leitura e escrita de dados passa por uma interface. As telas e as rotas nunca tocam em arquivos diretamente.

```ts
interface HubStorage {
  loadHub(): Promise<HubData>;
  saveHub(data: HubData): Promise<void>;
  loadState(): Promise<HubState>;          // lidos/salvos
  saveState(state: HubState): Promise<void>;
  loadFeedCache(): Promise<FeedCache>;     // posts já buscados
  saveFeedCache(cache: FeedCache): Promise<void>;
  exportBundle(): Promise<ExportBundle>;   // hub + estado (+ cache opcional)
  importBundle(b: ExportBundle, mode: 'replace' | 'merge'): Promise<void>;
}
```

- Implementação inicial: `JsonFileStorage` (arquivos em `HUB_DATA_DIR`).
- Implementações futuras: `SqliteStorage`, `RemoteStorage`. Trocar por variável de ambiente (`HUB_STORAGE=json|sqlite`).
- Escritas **atômicas** (gravar em arquivo temporário e renomear) e com backup do arquivo anterior (`hub.json.bak`).

### 4.3 Estrutura sugerida de pastas
```
hub/
  src/
    lib/
      types.ts                    # tipos HubData, HubState, FeedItem...
      schema.ts                   # Zod
      storage/
        index.ts                  # escolhe a implementação
        json-file.ts
      search.ts                   # Fuse.js
      filter.ts                   # lógica de palavra-chave (pura, testada)
      components/                 # Sidebar, TopBar, QuickAccess, FeedCard...
      server/
        feed/
          fetch.ts                # busca com timeout, User-Agent, cache
          parse-rss.ts
          youtube.ts
          reddit.ts
          scheduler.ts            # atualização periódica
    routes/
      +layout.svelte              # sidebar + topo
      +page.svelte                # Início
      c/[slug]/+page.svelte       # Categoria
      gerenciar/+page.svelte
      api/
        hub/+server.ts  state/+server.ts  feed/+server.ts
        refresh/+server.ts  export/+server.ts  import/+server.ts
  data/                           # padrão se HUB_DATA_DIR não for definido
    hub.json  estado.json  feed-cache.json
  .env.example                    # HUB_DATA_DIR, PORT, HUB_STORAGE
  README.md
```

### 4.4 Execução local
- Desenvolvimento: `npm run dev`.
- Uso diário: `npm run build` e depois `node build` (ou `npm start`). Opcional: atalho/script para iniciar com o Windows e definir `http://localhost:5757` como página inicial do navegador.
- O servidor deve escutar **somente em `127.0.0.1`**.

---

## 5. Modelo de dados

### 5.1 `hub.json` (config portátil: é o que vai de um PC para o outro)
```json
{
  "version": 1,
  "settings": { "accent": "#8AA4FF" },
  "categories": [
    { "id": "jogos", "name": "Jogos", "color": "#8AA4FF", "order": 1 }
  ],
  "groups": [
    { "id": "darktide", "categoryId": "jogos", "name": "Darktide", "order": 1 }
  ],
  "items": [
    {
      "id": "darktide-reddit",
      "type": "link",
      "name": "Subreddit r/Darktide",
      "url": "https://www.reddit.com/r/Darktide/",
      "categoryId": "jogos",
      "groupId": "darktide",
      "tags": ["reddit"],
      "pinned": false,
      "order": 2
    },
    {
      "id": "darktide-app",
      "type": "app",
      "name": "Abrir Darktide",
      "launch": { "kind": "protocol", "value": "steam://run/<APPID>" },
      "categoryId": "jogos",
      "groupId": "darktide",
      "tags": [],
      "pinned": true,
      "order": 1
    }
  ],
  "feedSources": [
    {
      "id": "reddit-darktide-patch",
      "type": "reddit",
      "name": "r/Darktide (patch)",
      "target": "Darktide",
      "categoryId": "jogos",
      "groupId": "darktide",
      "intervalMinutes": 30,
      "enabled": true,
      "include": ["patch"],
      "exclude": [],
      "matchMode": "any"
    }
  ],
  "savedFilters": [
    { "id": "patch", "label": "patch", "include": ["patch"], "exclude": [], "matchMode": "any" },
    { "id": "sem-promocao", "label": "sem: promoção", "include": [], "exclude": ["promoção"], "matchMode": "any" }
  ]
}
```

Notas:
- `type` de item: `link` | `app`. `type` de fonte: `rss` | `youtube` | `reddit`.
- `url` para links; `launch` para apps (`kind: "protocol"` na V1; `kind: "command"` só na V2+ e somente com lista permitida).
- Campos de ordem, `pinned` e `tags` são opcionais com valores padrão.
- `include`/`exclude` são listas de palavras. `matchMode`: `any` (qualquer palavra) ou `all` (todas).
- Todos os `id` são strings estáveis (slug ou uuid) e **referências quebradas** (ex.: `categoryId` inexistente) devem gerar erro de validação legível, com o caminho do problema.

### 5.2 `estado.json` (uso diário; exportar é opcional)
```json
{ "version": 1, "read": { "<postId>": "2026-11-09T12:00:00Z" }, "saved": ["<postId>"] }
```

### 5.3 `feed-cache.json` (regenerável; **não** entra no export por padrão)
Lista de posts normalizados:
```json
{ "version": 1, "updatedAt": "...", "items": [
  { "id": "hash(sourceId+guid)", "sourceId": "...", "title": "...", "summary": "...",
    "url": "...", "publishedAt": "...", "thumbnail": null }
] }
```

### 5.4 Export/Import
- **Exportar**: gera um único arquivo `hub-export-AAAA-MM-DD.json` com `hub` e, opcionalmente, `estado`.
- **Importar**: valida, mostra um resumo (quantos itens/fontes) e pede confirmação. Modos: **substituir** (com backup automático do atual) ou **mesclar** (por `id`).
- **Pasta sincronizada**: `HUB_DATA_DIR` aponta para uma pasta do Drive/OneDrive nos dois PCs; o servidor relê o arquivo quando ele muda (verificar a data de modificação a cada requisição ou usar um watcher). Cuidado com edição simultânea nos dois PCs; documentar isso no README.

---

## 6. Design e telas

As telas de referência foram aprovadas pelo dono (três telas: **Início**, **Categoria: Jogos**, **Editar: nova fonte**). O arquivo de referência visual deve acompanhar este documento (capturas de tela). Abaixo, a descrição para implementar fielmente.

### 6.1 Tokens visuais
| Token | Valor |
|---|---|
| Fundo da página | `#0F1115` |
| Fundo da sidebar | `#12151B` |
| Painel / card | `#161A21` |
| Painel elevado / input | `#1B2029` |
| Linha / borda | `#262C37` |
| Texto | `#E8EAF0` |
| Texto secundário | `#9AA3B2` |
| Texto auxiliar claro | `#C9CFDA` |
| Cor de destaque (padrão) | `#8AA4FF` (alternativas: `#7DD3A8`, `#F2A65A`, `#E58BC0`) |
| Texto sobre o destaque | `#0B1020` |
| Cores de categoria/fonte | azul `#8AA4FF`, verde `#7DD3A8`, laranja `#F2A65A`, rosa `#E58BC0`, roxo `#B79CFF`, vermelho `#F28B82`, azul-claro `#6CB6FF` |

- **Fontes**: Inter (texto) e Space Grotesk (títulos, logo), via Google Fonts (permitir fallback para `system-ui`).
- **Raios**: 8–10px em itens e botões, 12–14px em cards, círculo total (pílula) em chips.
- **Ícones**: SVG de traço (stroke 1.8), sem emojis.
- **Acessibilidade**: usar `button`, `a`, `input` + `label` reais; contraste mínimo 4,5:1; botões ≥ 40px de altura.
- A cor de destaque deve ser uma variável CSS (`--accent`), configurável em `settings.accent`.

### 6.2 Layout geral
- **Sidebar fixa à esquerda** (248px): logo "Meu Hub"; navegação (Início, Feed completo com contador de não lidos, Favoritos, Apps do PC); lista de **Categorias** com ponto colorido e contador de itens; "Nova categoria"; rodapé com "Gerenciar fontes e links" e status "Feed atualizado há X min".
- **Conteúdo** à direita, com padding de 32px.
- Em telas estreitas a sidebar passa para o topo (empilha); nada de `100vh` na sidebar.

### 6.3 Tela Início (`/`)
Ordem vertical:
1. **Barra do topo**: campo de busca grande com a dica `Ctrl K`; botão "Modo edição"; botão primário "Adicionar".
2. **Acesso rápido**: faixa de tiles (letra colorida + nome + tipo "Site"/"App do PC") com os itens `pinned: true`. Link "Editar atalhos".
3. **Feed** (coluna principal) com:
   - **Barra de filtro por palavra-chave**: campo livre (destaque na borda quando ativo); alternância "Qualquer palavra / Todas"; **filtros salvos** em chips com contagem (ex.: `patch · 5`, `hotfix · 2`, `sem: promoção`); botão "+ Salvar filtro".
   - Linha de chips de categoria (Tudo, Jogos, Notícias, Vídeos, Ferramentas, Não lidos) e contador "Mostrando X de Y posts".
   - **Cards de post**: miniatura (ou iniciais coloridas quando não houver imagem), fonte com ponto colorido, tempo relativo, tag da categoria, título com a **palavra filtrada destacada**, resumo curto, ações (Abrir, Salvar para depois, Marcar como lido). Botão "Carregar mais".
4. **Coluna direita** (largura máx. ~340px): "Fontes ativas" com contagem de não lidos e "+ Adicionar fonte"; "Nota rápida" (textarea salva no navegador/estado).

Na **V1** (sem feed) a área do feed mostra um aviso discreto de "Feed disponível em breve" ou fica oculta, sem quebrar o layout.

### 6.4 Tela Categoria (`/c/[slug]`)
1. Barra do topo igual à da Início (busca contextual "Buscar em Jogos"; botão "Adicionar em Jogos").
2. Cabeçalho: ponto colorido + nome da categoria (h1) + resumo ("24 itens em 4 grupos · 3 fontes de feed"); chips para alternar entre grupos (Todos os grupos, Darktide, Risk of Rain Returns...).
3. **Links e apps**: grade de cards, um por **grupo**, com o nome do grupo e a contagem; dentro, linhas clicáveis (letra colorida, nome, tipo: Site / Reddit / App do PC).
4. **Feed da categoria**: mesma barra de filtro da home, com o feed restrito às fontes dessa categoria.

Observação: para categorias como Ferramentas ou Trabalho, o agrupamento pode ser por tipo de uso em vez de "um jogo por grupo". O modelo (`groups`) já suporta os dois.

### 6.5 Tela Gerenciar (`/gerenciar`)
- Abas: Fontes do feed, Links, Apps do PC, Categorias, Regras do feed. Botão "Importar favoritos / OPML".
- Lista de fontes com nome, URL, tipo, categoria, intervalo e **interruptor liga/desliga**.
- **Painel lateral "Adicionar"** (a partir da V3) com abas Link / App do PC / Fonte de feed. Aba Fonte de feed: tipo (RSS/Atom, YouTube, Reddit, Bluesky/Mastodon, Monitorar página), endereço com detecção de RSS, nome, categoria, atualizar a cada, tags, "destacar se contiver", "silenciar se contiver", opção "Mostrar no feed da página inicial", Cancelar/Salvar.
- Na V1/V2 esta tela pode ser **somente leitura** + exportar/importar + status da validação do JSON.

> Tipos de fonte "Bluesky/Mastodon" e "Monitorar página (scraping)" aparecem no mockup como opções futuras; **não implementar na V2**.

---

## 7. Funcionalidades em detalhe

### 7.1 Busca Ctrl K
- Abre uma paleta sobre a tela com foco no campo; `Esc` fecha; setas navegam; `Enter` abre (link em nova aba; app dispara o protocolo).
- Índice: itens (nome, url, tags, categoria, grupo) e categorias. Na V2, também títulos do feed.
- Fuse.js com busca tolerante a acentos e erros de digitação.

### 7.2 Apps do PC
- V1: item `type: "app"` com `launch.kind: "protocol"` vira um link `href="steam://..."`. O navegador pode pedir confirmação na primeira vez; isso é normal e deve ser explicado no README.
- Apps sem protocolo próprio ficam para a V2+: o servidor local executa um comando **somente** se ele estiver numa lista permitida (`allowedApps`) e o pedido vier de `localhost`. Nada de executar texto livre vindo da interface.
- Exemplos de protocolo: `steam://run/<APPID>`, `discord://`, `vscode://`, `obsidian://`, `spotify://`. O sistema operacional do dono é **Windows**.

### 7.3 Feed (V2)
**Tipos de fonte**
- **RSS/Atom**: URL do feed. Parser genérico.
- **YouTube**: `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`. Aceitar a URL do canal e tentar resolver o ID; se não conseguir, pedir o ID **[sugestão]**.
- **Reddit**: **[validar]**. Estratégia preferida: baixar o feed do subreddit (`/r/<sub>/new.rss`) e **filtrar localmente** por palavra-chave (isso também funciona para qualquer outra fonte e evita depender da busca do Reddit). Alternativa: feed de busca do próprio Reddit com `restrict_sr`. Enviar `User-Agent` descritivo, respeitar limites, usar cache e intervalo mínimo (≥ 15 min), tratar 429 com backoff.

**Pipeline**
1. Scheduler (ou botão "Atualizar agora") percorre as fontes habilitadas conforme `intervalMinutes`.
2. `fetch` com timeout (~10 s), redirecionamento limitado, tamanho máximo de resposta.
3. Parse → normalização para `FeedItem`.
4. **Regras da fonte** (`include`/`exclude`/`matchMode`) aplicadas sobre título + resumo, sem diferenciar maiúsculas nem acentos.
5. Deduplicação por `guid`/URL; ordenação por data; limite de itens por fonte e retenção (ex.: 30 dias) **[sugestão]**.
6. Gravação no cache. Uma fonte com erro **não** derruba as outras; o erro fica visível na tela Gerenciar ("falhou há 2 h: HTTP 429").

**Filtro ao vivo (cliente)**: aplicado sobre o cache já carregado, instantâneo, com as mesmas regras (`include`/`exclude`/`matchMode`), filtros salvos e destaque do trecho encontrado. A lógica fica em `lib/filter.ts` (função pura compartilhada servidor/cliente) com testes.

**Segurança do conteúdo**: tratar títulos/resumos como texto; se houver HTML, sanitizar. Abrir links externos com `rel="noopener noreferrer"`.

### 7.4 Estado de leitura
`estado.json` guarda lidos e salvos. "Marcar tudo como lido" respeita o filtro atual. O contador da sidebar usa apenas não lidos.

---

## 8. Segurança e privacidade
- Servidor **só em `127.0.0.1`**; rejeitar requisições com `Origin`/`Host` inesperados (proteção contra CSRF/DNS rebinding).
- Nenhuma execução de comando vinda de texto livre. Lista permitida para qualquer abertura de app por servidor.
- Sem segredos no `hub.json`. Se algum dia houver chaves de API, ficam em variáveis de ambiente.
- `data/` no `.gitignore` se o projeto for versionado (o `hub.json` do dono é dado pessoal).
- Respeitar termos e limites de uso de cada fonte; sem scraping agressivo.

---

## 9. Riscos e pontos a validar
1. **Reddit**: confirmar num protótipo que o r/Darktide funciona de forma estável (feed + filtro local). Planejar uma alternativa se houver bloqueio.
2. **Rede do trabalho**: o PC do trabalho pode ter proxy/firewall. Testar a saída HTTP para YouTube/Reddit/feeds **antes** de investir no feed. Prever configuração de proxy (`HTTPS_PROXY`) **[sugestão]**.
3. **Protocolos no Windows**: cada app precisa do protocolo registrado; documentar como descobrir o protocolo de um app.
4. **Sincronização por pasta**: possíveis conflitos se o hub rodar nos dois PCs ao mesmo tempo; mitigar com backup e aviso no README.
5. **Edição manual do JSON**: erros de sintaxe são prováveis; a validação precisa ser amigável (linha/caminho, o que corrigir) e o app deve continuar abrindo com o último arquivo válido.

---

## 10. Ordem de implementação e critérios de aceite

**M0: Projeto**
- Criar o projeto SvelteKit (TypeScript, adapter-node), ESLint/Prettier, Vitest, `.env.example`, README inicial.
- *Aceite*: `npm run dev` sobe uma página vazia com o tema escuro e as fontes.

**M1: Dados e layout (V1)**
- Tipos + schema Zod; `JsonFileStorage`; `hub.json` de exemplo; rota `api/hub`.
- Sidebar, topo, tela Início (acesso rápido) e tela Categoria com grupos, fiéis ao design.
- *Aceite*: editar o `hub.json` e recarregar mostra as mudanças; JSON inválido mostra erro claro sem quebrar o app; layout responsivo.

**M2: Busca, apps, export/import (V1)**
- Ctrl K com Fuse.js; apps por protocolo; exportar/importar (substituir/mesclar, com backup); `HUB_DATA_DIR` configurável; tela Gerenciar em modo leitura.
- *Aceite*: exportar no PC A e importar no PC B reproduz tudo; abrir um app Steam por protocolo funciona.

**M3: Feed (V2)**
- Busca de RSS/YouTube/Reddit com cache, regras por fonte, scheduler, "Atualizar agora", erros por fonte.
- Cards de post, barra de filtro por palavra-chave, filtros salvos, destaque, lido/salvo, contadores.
- *Aceite*: `r/Darktide` + `patch` mostra só posts com "patch"; filtros ao vivo respondem instantaneamente; uma fonte que falha não afeta as demais.

**M4: Painel de edição (V3)**
- Painel "Adicionar" (Link/App/Fonte), lista de fontes com liga/desliga, edição e remoção, detecção de RSS, reordenação.
- *Aceite*: todas as operações gravam no `hub.json` de forma válida e atômica.

**M5: Acabamento**
- Testes das partes críticas (filtro, validação, storage, import/export), README completo (instalar, rodar, trocar de PC, descobrir protocolo de app, rede do trabalho), script de inicialização opcional.

---

## 11. Convenções **[sugestão]**
- Texto da interface em **português do Brasil**; identificadores de código em inglês; comentários em português.
- Commits pequenos por marco; sem dependências além das listadas sem necessidade clara.

## 12. Fora de escopo (por decisão do dono)
Twitter/X, tema claro, aplicativo móvel, modos de trabalho, hospedagem online, extensão de Chrome, login/usuários (tudo pode voltar depois; a arquitetura não deve impedir).

## 13. Dados que o dono ainda precisa fornecer
- Lista real inicial de **links**, **apps** (e seus protocolos), **categorias/grupos**.
- Lista real de **fontes do feed**: canais do YouTube (nomes/URLs), subreddits com palavras-chave, sites de notícias com RSS.
- Decisão sobre a pasta de dados (local ou sincronizada) em cada PC.
