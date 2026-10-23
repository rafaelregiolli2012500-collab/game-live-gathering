# Compilar e instalar GAME.LIVE no Windows

> A Lovable **não** gera o `.exe`. Execute estes comandos em um PC Windows 64-bit com Node.js 20+.

## 1. Preparar o projeto

```bat
git clone https://github.com/rafaelregiolli2012500-collab/game-live-gathering.git
cd game-live-gathering
npm install
npm i -D electron electron-builder concurrently wait-on cross-env
```

Aplique os arquivos deste pacote de correção (mesmos caminhos).

## 2. Credenciais locais

```bat
copy desktop\service\config.example.env desktop\service\.env
notepad desktop\service\.env
```

Preencha `SUPABASE_SERVICE_ROLE_KEY` e `GAME_LIVE_TOKEN` (Secrets do Supabase). **Não** commite o `.env`.

## 3. SQL opcional (recomendado)

No SQL Editor do Supabase, execute `desktop/service/sql/01_queue_rpc.sql` para claim atômico.

## 4. Desenvolvimento

```bat
npm run desktop:dev
```

## 5. Build + instalador

```bat
npm run build
npx electron-builder --win
```

Artefato em `release\GAME.LIVE-Setup-*.exe`.

## 6. Checklist pós-instalação

1. Abrir GAME.LIVE pelo atalho.
2. Ver status do serviço (não deve dizer “conectado” sem `.env` válido).
3. Enviar evento de teste (demo no painel OU test_ingest).
4. Confirmar golpe/animação no jogo.
5. Só então conectar TikFinity na live real.
