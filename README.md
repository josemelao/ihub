# Meu Hub

Hub pessoal local (página inicial do navegador) com links, apps do PC e, nas próximas fases, um feed por palavra-chave. Roda apenas no seu computador, em `localhost`.

## Status

- **M0 (projeto)** e **M1 (dados e layout)**: concluídos.
- **M2 (busca Ctrl K, apps, export/import)** e **M3 (feed)**: próximos marcos.
- O feed, o painel de edição e as ações de escrita aparecem desabilitados com aviso, sem quebrar o layout.
- Os dados iniciais vêm dos mockups de referência (categorias, grupos, atalhos fixados, fontes e filtros salvos).

## Stack

SvelteKit 3 + Svelte 5 (runes) + TypeScript, `@sveltejs/adapter-node`, Vitest, Zod, Fuse.js e adapter-node. Tema escuro único, responsivo.

## Como rodar

Requisitos: Node.js 24+ e npm.

```powershell
npm install
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

- `data/hub.json` — configuração portátil: categorias, grupos, itens (links/apps), fontes do feed e filtros salvos.
- `data/estado.json` — lidos/salvos (criado quando necessário).
- `data/feed-cache.json` — cache do feed (V2).

Edite o `hub.json` e recarregue a página. Se o JSON tiver erro, o app **não quebra**: mostra um aviso com o caminho do problema e usa `hub.json.bak` (o último arquivo válido), quando existir.

O schema e as referências (categoria/grupo inexistente, ids duplicados, URL inválida) são validados por Zod em `src/lib/schema.ts`.

## Telas

| Rota         | Tela                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| `/`          | Início: busca, acesso rápido, feed (placeholder na V1), fontes ativas e nota rápida |
| `/c/[slug]`  | Categoria: grupos, links/apps e feed da categoria                                   |
| `/feed`      | Feed completo (placeholder até a V2)                                                |
| `/favoritos` | Atalhos fixados e filtros salvos                                                    |
| `/apps`      | Apps do PC por categoria (abrem por protocolo)                                      |
| `/gerenciar` | Fontes e links em modo somente leitura                                              |
| `/api/hub`   | JSON do hub validado                                                                |

## Estrutura

```
src/
  lib/
    types.ts              # tipos do domínio
    schema.ts             # validação Zod + referências
    display.ts            # helpers de exibição (iniciais, cor, contagens)
    storage/              # JsonFileStorage e fábrica
    components/           # Sidebar, TopBar, QuickAccess, cards...
  routes/                 # páginas e api/hub
data/hub.json             # dados temporários vindos dos mockups
mockups/                  # referências visuais (.dc.html) — não é o app
PLANEJAMENTO-hub.md       # decisões, fases e critérios de aceite
```

## Qualidade

```powershell
npm test        # Vitest (schema, storage, helpers e seed)
npm run check   # svelte-check
npm run lint    # Prettier + ESLint
```

## Mockups

Os arquivos em `mockups/` são referências visuais exportadas de ferramenta de design (rodam com React via `support.js`). Para vê-los:

```powershell
python -m http.server 8000
# http://localhost:8000/mockups/Main.dc.html
# http://localhost:8000/mockups/Categoria.dc.html
# http://localhost:8000/mockups/Gerenciar.dc.html
```

Eles não fazem parte do build do app.

## Segurança e limites da V1

- Servidor só em `127.0.0.1`.
- Apps abrem apenas por protocolo (`steam://`, `discord://`, `vscode://`...). Execução de comandos fica para a V2, com lista permitida.
- Sem login, sem versão online, sem tema claro.
- Busca Ctrl K, escrita na interface, export/import e feed entram nos próximos marcos.
