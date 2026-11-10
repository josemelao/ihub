# Sprint 0 — baseline, decisões e preparação

> Data: 10/11/2026  
> Commit de baseline: `d799914`  
> Tag: `v0.6.0`  
> Backup local: `data/backups/sprint-0-20261110-114313/`

## Baseline

| Item                    | Valor                  |
| ----------------------- | ---------------------- |
| Categorias              | 5                      |
| Grupos                  | 8                      |
| Itens                   | 31 (7 apps + 24 links) |
| Fontes no hub           | 4                      |
| Posts no cache          | 51                     |
| Posts salvos            | 2                      |
| Arquivos de teste       | 18                     |
| Testes                  | 172                    |
| Linhas em `src/app.css` | 2.176                  |
| Arquivos em `src/`      | 80                     |

## Performance baseline

- `npm test`: ~2,6 s para 172 testes.
- `vite build`: ~0,8 s para o cliente, mais cópia/compressão do adapter.
- `npm run verify`: check + lint + testes + build em sequência.
- Performance de interação no navegador (100/500/1.000 posts) ainda não medida; medir antes de PLAT-12.

## Recursos novos desde `e43ab1b`

Estes recursos já existem e entram na checklist de regressão. Não devem ser refeitos:

- Biblioteca com abas, busca, categorias recolhíveis, grupos e ícones.
- CRUD de grupos e contagem de itens/fontes.
- Favoritos com busca, ordenação e badge na sidebar.
- Editor compacto com cabeçalho/rodapé fixos e seções.
- Player de YouTube em modal.
- Lightbox de imagens.
- Player de Reddit com detecção de vídeo e fallback para imagem.
- Interruptor “Exibir em inglês” por fonte Reddit, preservado nos snapshots.
- Descrição curta de itens e limite de posts por fonte.
- Cor de destaque em Gerenciar → Aparência.

## Decisões tomadas

- **Busca:** incluir posts do feed na palette, com limite e índice memoizado.
- **Terminologia:** página **Favoritos**; ação **Salvar para depois**; contadores “posts salvos”. **Biblioteca** = links + apps; **Fontes** = origens do feed; **Gerenciar** = edição.
- **Notas:** arquivo próprio `notes.json`, fora do `hub.json`, incluído no export.
- **Reader mode:** `@mozilla/readability` + `linkedom`, com sanitização; adiado para P2.
- **Sync:** pasta + detecção de conflito; sem serviço externo.
- **Autostart:** VBS/atalho na pasta Startup primeiro.
- **LAN:** manter `127.0.0.1`; token opcional só se houver exposição na rede.
- **Tema:** somente dark.
- **IA:** sem IA na nuvem; qualquer IA local é opcional e fora do escopo.
- **Retenção/backup:** lidos por 90 dias (salvos nunca), 7 gerações de backup em `data/backups/`.
- **SQLite:** apenas quando bater o critério (>5.000 posts, >500 itens, full-text/highlights ou múltiplos processos).
- **Read later:** metadados + highlights primeiro; arquivo completo depois.
- **CSP:** allowlist para YouTube, Reddit, fontes e imagens; Report-Only antes de enforce.
- **Migrações:** defaults do Zod para campos opcionais; migração versionada só para mudanças quebrantes.
- **CI:** `npm run verify` local; GitHub Actions só quando houver remote.

## O que foi preparado

- Backup completo de `data/` (ignorado pelo Git).
- Tag `v0.6.0` no commit de baseline.
- Script `npm run verify` (check + lint + testes + build).
- `.gitignore` atualizado para `data/backups/`.
- Checklist de regressão em `docs/checklist-regressao.md`.
- Plano completo versionado em `PLANO-EXECUCAO.md`.

## Próximo sprint

Sprint 1 — recorte de P0 UX:

1. Título do card clicável nas três visões.
2. Terminologia e contraste.
3. Filtros com texto correto.
4. Fontes com erro apenas ativas.
5. Limpeza de cache ao mudar `target`/`type`.
6. Busca de salvos com resumo e destaque.
7. Confirmação/desfazer de “marcar tudo como lido”.
8. Switch de fonte com semântica.
9. Palette com focus trap/backdrop/scroll lock.
10. Aviso de alterações não salvas.
11. Deep links de adicionar.
12. Posts na palette.
13. Favicon/metadados.

## Comandos

```powershell
npm run verify
```

O comando roda, em sequência: `check`, `lint`, `test` e `build`.
