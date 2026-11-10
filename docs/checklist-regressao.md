# Checklist de regressão — Meu Hub

Use antes de fechar qualquer sprint ou mudança que toque em feed, editor, Biblioteca, Favoritos ou players.

## Qualidade automática

- [ ] `npm run verify` passa (check + lint + testes + build).
- [ ] Nenhum arquivo de `data/` ou `.env` foi commitado.
- [ ] `git status` limpo após o commit.

## Páginas e dados

- [ ] `/`, `/feed`, `/favoritos`, `/biblioteca`, `/gerenciar` respondem 200.
- [ ] `/apps` continua redirecionando para `/biblioteca`.
- [ ] `hub.json` inválido mostra aviso e usa backup.
- [ ] Exportar e importar mantém categorias, grupos, itens, fontes, filtros e salvos.
- [ ] Fonte quebrada não derruba as demais.

## Feed e visões

- [ ] Alternar Bento, Compacto e Completo não anima a ordenação.
- [ ] Filtro, busca, lido/não lido e “Carregar mais” continuam animando.
- [ ] Título do card abre o post em nova aba.
- [ ] Ações de abrir, salvar e marcar lido funcionam em ícones.
- [ ] “Marcar tudo como lido” pede confirmação; o desfazer funciona e sobrevive a reload dentro de 30 s.
- [x] Sidebar mostra não lidos por categoria; chips de categoria/fonte mostram contagem.
- [x] Chips de fonte alternam o feed e respeitam a categoria selecionada.
- [x] “Marcar antigos” (1/3/7 dias) age sobre a visão atual, confirma e permite desfazer.
- [x] Contador da sidebar bate com os não lidos da visão do feed.
- [x] Cache de fonte removida é limpo ao carregar o layout.
- [x] Filtro salvo com categoria/fonte/não lidos persiste e aplica o escopo após reload.
- [x] Remover fonte ou categoria limpa o escopo dos filtros salvos.
- [ ] Imagens externas e placeholders aparecem corretamente.

## YouTube

- [ ] Thumbnail com ▶ abre o player em modal.
- [ ] Autoplay funciona; Esc, X e clique fora fecham.
- [ ] “Abrir no YouTube” abre o vídeo correto.
- [ ] O layout do Bento não muda ao abrir/fechar.

## Imagens

- [ ] Thumbnail que não é vídeo abre o lightbox.
- [ ] “Abrir imagem” e “Abrir publicação” funcionam.
- [ ] O ícone de expandir aparece no hover/focus.
- [ ] Esc, X e clique fora fecham.

## Reddit

- [ ] Selo Reddit aparece na thumbnail.
- [ ] Post de vídeo abre o player do Reddit.
- [ ] Post de imagem cai no lightbox.
- [ ] “Abrir no Reddit” funciona.
- [ ] Fonte com “Exibir em inglês” ligado usa `locale=en`.
- [ ] Fonte desligada usa o idioma do navegador.
- [ ] Post salvo preserva o `locale` no snapshot.

## Biblioteca

- [ ] Abas Todos / Apps do PC / Navegador funcionam.
- [ ] Busca por nome, grupo, categoria, tag e descrição funciona.
- [ ] Categorias recolhem/expandem e lembram o estado.
- [ ] “Recolher tudo / Expandir tudo” funciona.
- [ ] Busca expande categorias e restaura o estado anterior.
- [ ] Grupos mostram itens e fontes corretos.
- [ ] Ícones de favicon/Simple Icons têm fallback de iniciais.
- [ ] Itens sem grupo aparecem em “Sem grupo”.

## Favoritos

- [ ] Busca local funciona.
- [ ] Ordenação Salvos/Publicados funciona.
- [ ] Badge da sidebar reflete a quantidade.
- [ ] Snapshot permanece se a fonte/cache sumir.

## Gerenciar

- [ ] Abas Fontes, Itens, Grupos, Categorias, Filtros salvos, Backups e Aparência funcionam.
- [ ] Editor abre compacto, sem campos esticados; cabeçalho/rodapé fixos.
- [ ] Link/App: descrição, ícone, tags, categoria, grupo e fixar.
- [ ] Fonte: tipo, alvo, nome, categoria, grupo, intervalo, limite, filtros, ativo e interruptor de inglês.
- [ ] Reddit: interruptor “Exibir em inglês” só aparece para Reddit.
- [ ] Botão “Atualizar esta fonte” funciona.
- [ ] “Detectar” funciona para RSS e YouTube.
- [ ] Criar/editar/remover/reordenar item, grupo, categoria e fonte.
- [ ] Remoção usa diálogo próprio; grupo/categoria em uso bloqueia.
- [ ] Aparência salva a cor de destaque.

## Acessibilidade e mobile

- [ ] Navegação por teclado em sidebar, feed, Biblioteca, Gerenciar e modais.
- [ ] Foco visível e devolvido ao fechar modais.
- [ ] `prefers-reduced-motion` desliga animações.
- [ ] Layout em 375 px sem sidebar ocupando a tela inteira.
- [ ] Textos essenciais legíveis; cards lidos continuam distinguíveis.

## Segurança

- [x] CSP não bloqueia Google Fonts, thumbnails, YouTube ou Reddit.
- [x] `frame-src` permite `youtube-nocookie.com` e `redditmedia.com`.
- [x] `img-src` permite as imagens dos feeds.
- [x] `Referrer-Policy` não quebra os players.
- [ ] Trocar Report-Only por enforce após revisar o console.
- [ ] Remover `'unsafe-inline'` de `script-src` com nonce/hash.
- [ ] Confirmar URL de feed/snapshot só `http(s)`.
- [ ] Confirmar limite de corpo (413) e SSRF no refresh.

## Dados e concorrência

- [x] 10 marcações de leitura simultâneas não perdem nenhuma.
- [x] 10 filtros salvos simultâneos não perdem nenhum.
- [x] Remover/trocar fonte limpa itens e status do cache.
- [x] Cache inválido impede a remoção da fonte.
- [x] Nenhum `.tmp-*` fica em `data/` após salvar.
- [x] Existem 7 gerações de `.bak` após gravações suficientes.
- [x] “Criar ponto de restauração” cria pasta datada e o Gerenciar mostra a idade.
- [x] Aba Backups concentra a área e `?tab=backups` abre direto.
- [x] Pontos de restauração listam data, caminho absoluto, arquivos e tamanho.
- [x] “Restaurar” pede confirmação, cria ponto de segurança e recarrega a página.
- [x] “Baixar” gera um JSON importável daquele ponto.
- [x] “Excluir” remove o ponto com confirmação e não afeta os `.bak` automáticos.
- [x] Restauração rejeita id com travessia de caminho e hub inválido.
- [x] Só os 10 pontos manuais mais recentes são mantidos.
- [x] Preview de importação mostra novos/atualizados/removidos.
- [x] Merge mantém as settings atuais por padrão.
- [x] Leituras com mais de 90 dias são podadas; posts salvos ficam.
