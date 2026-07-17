# Fluxo de conversa

```text
Meta webhook assinado
  -> normalizacao provider-neutral
  -> InboundEvent deduplicado
  -> identidade de canal + cliente + conversa
  -> ACK HTTP
  -> worker assincorno
  -> prompt versionado + historico curto
  -> NVIDIA tool calling
  -> tools validadas no backend
  -> OutboundMessage
  -> worker Cloud API
  -> status sent/delivered/read/failed
```

Estados operacionais: `AI_ACTIVE`, `WAITING_HUMAN`, `HUMAN_ACTIVE`, `PAUSED` e `CLOSED`. Entrada em estado humano/pausado e persistente e impede o worker de IA de responder.

Assumir conversa deriva o usuario do JWT e revalida membership ativo da loja. Enviar manualmente tambem assume a conversa. Devolver muda para `AI_ACTIVE`; fechar muda para `CLOSED`.

O webhook persiste e responde antes da inferencia. A correlacao e feita por `InboundEvent.correlationId`, `AiExecution`, hashes de tool calls e IDs da outbox, sem registrar conteudo em logs operacionais.
