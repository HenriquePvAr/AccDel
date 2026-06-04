# Atendente IA: provider Lovable backend

Este documento descreve a integracao Cain Delivery -> Lovable para respostas do Atendente IA.

## Visao geral

O Cain Delivery nao chama o Lovable AI Gateway diretamente. A API do Cain chama apenas o endpoint seguro do backend Lovable:

```text
POST /api/public/bot-reply
```

O endpoint Lovable valida HMAC SHA-256. O segredo no Cain deve ser o mesmo segredo configurado no Lovable como `CAIN_WEBHOOK_SECRET`.

O Cain Delivery continua usando Prisma/PostgreSQL como fonte principal para loja, conversas, mensagens e rascunhos de pedido. Supabase/Lovable nao vira banco principal do Cain.

## Variaveis de ambiente no Cain

Configure no `.env` local da API:

```env
AI_PROVIDER=lovable_backend
LOVABLE_BOT_REPLY_URL=https://SEU_BACKEND_LOVABLE/api/public/bot-reply
LOVABLE_BOT_REPLY_SECRET=<mesmo valor configurado como CAIN_WEBHOOK_SECRET no Lovable>
LOVABLE_BOT_REPLY_TIMEOUT_MS=20000
```

Nao coloque o segredo real em codigo, `.env.example`, frontend, logs ou docs. Segredos fracos podem ser usados apenas em teste local e devem ser trocados em producao.

## Assinatura HMAC

O Cain monta o payload, serializa com `JSON.stringify(payload)` e assina exatamente esse corpo bruto:

```ts
const body = JSON.stringify(payload)
const signature = createHmac('sha256', secret).update(body).digest('hex')
```

Headers enviados:

```text
Content-Type: application/json
x-cain-timestamp: <payload.timestamp>
x-cain-signature: <hmac hex>
x-cain-store-id: <payload.storeId>
```

O corpo assinado e o corpo enviado precisam ser identicos. Nao reserializar depois de assinar.

## Payload enviado ao Lovable

```json
{
  "conversationId": "conversation-id",
  "storeId": "store_main",
  "customer": {
    "name": "Cliente",
    "phone": "5592999999999"
  },
  "message": "Mensagem atual do cliente",
  "history": [
    {
      "role": "user",
      "content": "Oi"
    },
    {
      "role": "assistant",
      "content": "Ola! Como posso ajudar?"
    }
  ],
  "context": {
    "channel": "whatsapp",
    "orderMode": "delivery"
  },
  "timestamp": "2026-05-28T00:00:00.000Z"
}
```

O historico e limitado as mensagens recentes da conversa. Mensagens inbound/customer viram `user`; mensagens outbound de IA ou humano viram `assistant`.

## Resposta esperada

Sucesso:

```json
{
  "ok": true,
  "reply": "Sim, entregamos no Centro.",
  "intent": "duvida",
  "confidence": 0.9,
  "shouldTransferToHuman": false,
  "sourcesUsed": ["cardapio", "faq"],
  "orderDraft": null
}
```

Falha:

```json
{
  "ok": false,
  "error": "Mensagem segura do erro"
}
```

Em falha, o Cain nao gera resposta fake. O erro aparece de forma honesta na aba Testar atendente e o pipeline do WhatsApp marca a conversa para atendimento humano quando aplicavel.

## Como testar pela aba Testar atendente

1. Configure as variaveis no `.env` da API.
2. Reinicie a API.
3. Abra o admin em modo API.
4. Acesse Atendente IA -> Testar atendente.
5. Envie uma mensagem de cliente.

Resultado esperado:

- resposta exibida em `reply`;
- `intent`, `confidence`, `sourcesUsed` e `shouldTransferToHuman` visiveis na tela;
- `orderDraft` exibido quando o Lovable retornar rascunho.

Sem `LOVABLE_BOT_REPLY_URL` ou `LOVABLE_BOT_REPLY_SECRET`, o Cain deve mostrar `Provider de IA nao configurado`.

## Como testar pelo WhatsApp

1. Configure o provider WhatsApp real.
2. Configure `AI_PROVIDER=lovable_backend` e as variaveis Lovable.
3. Ative o Atendente IA em modo `automatic` ou `hybrid`.
4. Envie uma mensagem pelo WhatsApp.

Pipeline esperado:

1. Cain salva inbound no PostgreSQL.
2. Cain verifica modo da IA.
3. Cain envia contexto assinado para o backend Lovable.
4. Lovable retorna resposta estruturada.
5. Cain salva fontes/metadados em `rawPayload`.
6. Se houver `orderDraft`, Cain salva `AiOrderDraft` como `suggested`.
7. Cain nao cria pedido automaticamente.
8. Cain aplica delay humanizado.
9. Antes de enviar, Cain verifica se humano assumiu.
10. Cain envia pelo provider WhatsApp e salva outbound como IA.

## Limitacoes atuais

- O provider OpenAI/Groq/OpenRouter ainda precisa de adapters reais se for usado.
- `orderDraft` cria apenas rascunho para aprovacao humana.
- A validacao ponta a ponta depende do endpoint Lovable real e de segredo igual nos dois lados.
- Segredo incorreto deve retornar falha HMAC no Lovable; o Cain trata como erro seguro e nao vaza segredo.
