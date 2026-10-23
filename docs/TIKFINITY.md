# Configuração TikFinity → GAME.LIVE

## O que foi implementado

Servidor HTTP local no processador Node:

```
http://127.0.0.1:8787/tikfinity/event
```

Aceita POST JSON no formato TikFinity / TikTok-like (`event` + `data` com `uniqueId`, `giftName`, `repeatCount`, etc.), normaliza e envia para a Edge Function:

```
POST https://cudjcpheouvumwalslff.supabase.co/functions/v1/game-live-events
Header: x-game-token: <GAME_LIVE_TOKEN>
```

## Configuração no TikFinity (manual)

1. Instale e abra o **TikFinity Desktop** no mesmo PC do GAME.LIVE.
2. Conecte sua conta/live TikTok conforme o setup oficial do TikFinity.
3. Em **Actions & Events** (ou Event API / Webhook / Third-party), configure um destino HTTP para presentes:
   - URL: `http://127.0.0.1:8787/tikfinity/event`
   - Método: POST
   - Corpo: JSON do evento de gift (formato padrão do TikFinity)
4. Se o TikFinity só oferecer **Event API** local, aponte a ferramenta para o mesmo host/porta ou use um bridge que faça POST neste URL.
5. Teste com um gift de baixo valor na live de teste.

## O que NÃO foi testado neste ambiente

- Conexão real TikFinity ↔ TikTok Live.
- Formato exato do payload da sua versão do TikFinity (o normalizador é flexível, mas pode precisar de ajuste de campos).

## Teste sem TikFinity

No app desktop, via IPC `desktopBridge.testIngest({ gift_name: "Rosa", character_key: "lula", username: "jogador_teste" })` ou stdin do serviço:

```json
{"type":"test_ingest","gift_name":"Rosa","character_key":"lula","username":"jogador_teste","event_id":"TESTE_LOCAL_001"}
```

Isso chama a Edge Function real (precisa de `GAME_LIVE_TOKEN` válido). Não prova TikTok.
