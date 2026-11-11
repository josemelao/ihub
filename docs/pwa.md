# PWA, offline e autostart

> Data: 11/11/2026
> Base: `v0.15.0`
> Tarefas: PLAT-01 (PWA/offline) e PLAT-02 (autostart no Windows)

## PWA

- `static/manifest.webmanifest`: nome, `start_url=/`, `display=standalone`, tema `#0F1115` e ícones 192/512 (any + maskable).
- Ícones em `static/icons/` (PNG gerados com o “H” do hub).
- `static/sw.js`:
  - install/activate com versão de cache `meu-hub-shell-v1`;
  - navegação: rede primeiro; sem rede, serve `offline.html`;
  - estáticos (`/_app/immutable/`, `/icons/`, manifest e favicon): cache primeiro;
  - nunca intercepta `/api/`, métodos diferentes de GET ou outra origem.
- Registro em `src/routes/+layout.svelte` apenas em produção (`import.meta.env.PROD`).
- CSP ganhou `worker-src 'self'` (continua Report-Only).

### Instalar

No Chrome/Edge, abra <http://127.0.0.1:5757> e use **Instalar aplicativo** (ícone na barra de endereço ou menu). `127.0.0.1` conta como contexto seguro.

### Offline

O app abre offline apenas com a tela de aviso; os dados continuam no servidor local. Para voltar:

```powershell
npm start
```

O service worker não guarda `hub.json`, `estado.json`, `feed-cache.json` nem respostas da API.

## Autostart no Windows

Instalação por usuário, sem admin:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1
```

O script cria `Meu Hub.lnk` na pasta **Startup** apontando para `wscript.exe //B scripts\start-hidden.vbs`. O VBS:

- resolve `%ProgramFiles%\nodejs\node.exe` (fallback `node.exe` no PATH);
- define o diretório do projeto e roda `node scripts/start.mjs` com janela oculta.

Requisitos: Node 24+ e `npm run build` já executado (o script avisa se `build/index.js` não existe).

Para desativar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\uninstall-autostart.ps1
```

### Limitações

- Não há log do processo oculto; para diagnosticar, rode `npm start` manualmente.
- A validação de logon real fica com o dono: instalar, sair e entrar no Windows, abrir `http://127.0.0.1:5757`.
- Alternativa: Agendador de Tarefas com gatilho “Ao fazer logon” e ação `node scripts\start.mjs` em “Iniciar em” na pasta do projeto.
- O atalho é por usuário; outro usuário do Windows precisa rodar o install novamente.

## Verificação

- `npm run verify` verde; **408 testes** em 54 arquivos.
- Testes estáticos: manifest, tamanhos reais dos PNGs, service worker, offline e presença dos scripts.
- Teste de autostart: instala e remove o atalho em uma pasta Startup temporária.
- Edge/CDP:
  - `Page.getInstallabilityErrors` → `[]`;
  - service worker `activated` e controlando a página;
  - cache `meu-hub-shell-v1`;
  - com rede desligada e cache HTTP desabilitado, a navegação serviu “Meu Hub está offline”.

## Checklist manual

1. Abrir no Chrome/Edge e confirmar o convite de instalação.
2. Instalar, fechar a janela e abrir pelo ícone.
3. Parar o servidor e recarregar: conferir a tela offline.
4. Rodar `install-autostart.ps1`, sair/entrar no Windows e abrir `127.0.0.1:5757`.
5. Rodar `uninstall-autostart.ps1` e confirmar que não inicia mais.
