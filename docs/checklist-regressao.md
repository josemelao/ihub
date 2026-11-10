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

- [ ] Abas Fontes, Itens, Grupos, Categorias, Filtros salvos e Aparência funcionam.
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

## Segurança (quando CSP/headers entrarem)

- [ ] CSP não bloqueia Google Fonts, thumbnails, YouTube ou Reddit.
- [ ] `frame-src` permite `youtube-nocookie.com` e `redditmedia.com`.
- [ ] `img-src` permite as imagens dos feeds.
- [ ] `Referrer-Policy` não quebra os players.
- [ ] Testar em Report-Only antes de enforce.
