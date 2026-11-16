# Performance com 1.000 posts — medição e decisão (PLAT-12 light)

> Executado em 16/11/2026 sobre a `v0.34.0`, fechando o PLAT-12 sem virtualização nem SQLite.

## Cenário medido

- 10 fontes RSS, 100 posts cada = **1.000 posts** no cache.
- 30 links, 1 categoria, 300 lidos e 30 salvos.
- Posts com título/resumo realistas, datas em ordem e URLs válidas.
- Fixture sintética em memória — nenhum dado real tocado.

## Método

`src/lib/perf/feed-1000.test.ts` aquece uma vez e mede a **mediana de 5 execuções** de cada operação. O teste roda no `npm test` e falha se estourar o orçamento:

| Operação                      | Mediana | Orçamento |
| ----------------------------- | ------: | --------: |
| `buildFeedView` (1.000 posts) |  4,5 ms |    150 ms |
| Filtro de 1.000 por termos    |  2,1 ms |     50 ms |
| Construção do índice Fuse     |  0,4 ms |    400 ms |
| Consulta Fuse                 |  0,6 ms |     50 ms |
| `buildSavedView`              |  0,1 ms |     50 ms |
| Payload do `feed-cache.json`  |  256 KB |      2 MB |

Para ver os números no console:

```powershell
$env:PERF_LOG='1'; npx vitest run src/lib/perf/feed-1000.test.ts --silent=false
```

## Por que não virtualizar nem migrar para SQLite

- O `FeedBoard` já pagina: renderiza **10 cards** e usa “Carregar mais”. O DOM nunca recebe 1.000 cards de uma vez; o masonry posiciona só os visíveis.
- O índice de busca é memoizado por identidade de `hub`/`feed` (`src/lib/search.ts`), então digitar não reconstrói o índice.
- A visão completa e o filtro ficam na casa de **poucos milissegundos** para 1.000 posts.
- Virtualizar o Bento/masonry mexeria no posicionamento absoluto, nas animações e na seleção por teclado — risco alto para ganho nulo neste volume.
- O critério de SQLite continua não atendido: **>5.000 posts, >500 itens, full-text/highlights ou múltiplos processos**. Hoje: 165 posts, 31 itens e um único processo.

## Estado real (16/11/2026)

- `feed-cache.json`: **165 posts / 124 KB**.
- 9 fontes: 4 Reddit (25 cada), 1 YouTube (15), 4 RSS (0–30).
- O cache guarda a **janela atual de cada fonte** (a última busca bem-sucedida), não 30 dias acumulados. Para 1.000 posts reais seriam necessárias ~35 fontes de alto volume, ou `maxItems` maior nos RSS — decisão de produto, não de performance.

## Quando revisitar

- Se o cache passar de ~500 posts e a interação passar de **100 ms**.
- Se a busca ou “Carregar mais” engasgar no uso real.
- Se surgirem múltiplos processos, full-text pesado ou mais de 5.000 posts — aí o critério de SQLite é reavaliado.

Enquanto isso: **JSON + lock por processo**, paginação de 10 e índice memoizado são suficientes.
