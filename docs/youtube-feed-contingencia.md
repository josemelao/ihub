# Contingência — feed do YouTube intermitente (404/500)

Registrado em 13/11/2026, durante a correção de feeds comprimidos e do ritmo do
Reddit (seção 44 do `HANDOFF.md`).

**Status: não implementado.** Fica aqui para retomar se a fonte YouTube voltar a
incomodar. Nada do app precisa mudar para se recuperar — o endpoint do YouTube
volta sozinho.

## 1. Sintoma

A fonte `youtube-guias` ("Mister E", `UCy7DyzEEC9h81lmwg6H5rlw`) passa a falhar
no refresh com `HTTP 404` (às vezes `HTTP 500`) e a home mostra o selo de erro.
Os vídeos já baixados continuam no cache — não há perda de dados.

## 2. Diagnóstico (13/11/2026)

| Verificação                                                                  | Resultado                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| Canal `UCy7DyzEEC9h81lmwg6H5rlw`                                             | existe: **"Mister E."**, `externalId` igual ao do hub |
| `feeds/videos.xml?channel_id=…`                                              | 404 na maioria, 500 às vezes, 400 sem query           |
| Canal de controle (`UC_da Google Developers`)                                | **404 também** → não é o canal do usuário             |
| 8 IPs de borda do `www.youtube.com`, testados um a um                        | 404 em **todos**                                      |
| UA de navegador, `accept` de RSS, `accept-language`, cookie `CONSENT`/`SOCS` | indiferente                                           |
| `fetch` puro (sem o pinning de IP do `safe-fetch`)                           | mesmo 404 → não é SSRF/rede do app                    |
| 11 tentativas seguidas                                                       | **2 voltaram 200** com XML válido (~25 KB)            |

Conclusão: o ID do canal está correto e o app está correto. O endpoint
`/feeds/videos.xml` do YouTube responde 404/500 em janelas de horas, para canais
aleatórios, e se recupera sozinho. É um problema conhecido em 2026 (relatos nas
comunidades do n8n, newsboat, NewsBlur e Feeder).

## 3. Comportamento atual do app (aceitável)

- `HTTP 404`/`500` não é `RateLimitError`, então o `lastFetchedAt` avança e a
  fonte volta a tentar no próximo intervalo (padrão 30 min).
- Itens antigos são preservados; a fonte aparece com erro em Gerenciar e no
  `HomeStatus`.
- Nenhuma ação do usuário é necessária.

## 4. Opções mapeadas

| Opção                                                  | Esforço                          | Efeito                                                           | Risco                                        |
| ------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| **A. Não fazer nada**                                  | zero                             | volta sozinho; recupera em até 30 min                            | nenhum                                       |
| **B. Trocar o alvo da fonte para o espelho openrss**   | zero código (Gerenciar → Fontes) | funciona na hora                                                 | entrega **1 vídeo**; dependência de terceiro |
| **C. Fallback automático para openrss** em 404/500     | ~1 h                             | cobre a janela de queda mantendo o feed oficial quando ele volta | espelho pode cair junto                      |
| **D. Raspar `/channel/<ID>/videos`** (`ytInitialData`) | ~2–3 h                           | independe de terceiros                                           | quebra se o YouTube mudar o HTML             |

Recomendação registrada: **A por padrão**; **C** se o selo de erro incomodar
durante as janelas; **D** só se for inaceitável depender de terceiro.

## 5. Rotas testadas em 13/11/2026

| Rota                                                   | Status              | Observação                             |
| ------------------------------------------------------ | ------------------- | -------------------------------------- |
| `openrss.org/feed/www.youtube.com/channel/<ID>/videos` | ✅ 200, Atom válido | 40 ms com cache, ~1 s frio; **1 item** |
| `rsshub.app/youtube/channel/<ID>`                      | ❌ 403              | Cloudflare                             |
| `pipedapi.kavin.rocks/streams/<ID>`                    | ❌ 526              | instância fora                         |
| `pipedapi.adminforge.de/streams/<ID>`                  | ❌ 403              | —                                      |
| `invidious.jing.rocks/api/v1/channels/<ID>`            | ❌ falha de conexão | —                                      |
| `youtube.com/channel/<ID>/rss`                         | ⚠️ 200, mas HTML    | é a página do canal, não feed          |

URL do espelho, pronta para colar em Gerenciar → Fontes (opção B):

```
https://openrss.org/feed/www.youtube.com/channel/UCy7DyzEEC9h81lmwg6H5rlw/videos
```

## 6. Esboço da opção C, se for retomada

Objetivo: tentar o feed oficial; se vier 404/500, tentar o espelho; se o espelho
responder, usar os itens dele sem marcar a fonte como quebrada.

Pontos de entrada:

- `src/lib/feed/youtube.ts` — hoje só extrai ID de vídeo. Caberia
  `youtubeMirrorUrl(channelId)`.
- `src/lib/feed/sources.ts` — `feedUrlFor`/`resolveFeedUrl` resolvem o alvo do
  tipo `youtube`; é onde o fallback precisa entrar (e onde o `channel_id` já é
  conhecido).
- `src/lib/feed/refresh.ts` — o `catch` do `refreshOne` é o lugar para tentar o
  espelho antes de gravar erro. Só para `source.type === 'youtube'`.
- `src/lib/net/safe-fetch.ts` — o espelho passa pelo mesmo `fetchPublicText`,
  com as mesmas proteções de SSRF/limite.

Cuidados:

- Só fazer o fallback para `404`/`500` (não para `429`, que já tem backoff).
- Guardar qual URL respondeu (`finalUrl`) para o log/status, sem trocar o
  `target` do hub.
- O espelho entrega **1 item**; não usar `maxItems` como sinal de saúde.
- Adicionar teste em `src/lib/feed/youtube.test.ts` cobrindo `youtubeMirrorUrl`
  e um em `src/lib/feed/refresh.test.ts` com o primeiro fetch falhando em 404 e
  o espelho respondendo Atom.

## 7. Como reavaliar rápido

```powershell
# estado do endpoint oficial
Invoke-WebRequest "https://www.youtube.com/feeds/videos.xml?channel_id=UCy7DyzEEC9h81lmwg6H5rlw" -UseBasicParsing |
  Select-Object StatusCode

# estado do espelho
Invoke-WebRequest "https://openrss.org/feed/www.youtube.com/channel/UCy7DyzEEC9h81lmwg6H5rlw/videos" -UseBasicParsing |
  Select-Object StatusCode, Content
```

Se o oficial voltou a responder 200 com `<feed>`, não há nada a fazer: a próxima
atualização da fonte resolve.
