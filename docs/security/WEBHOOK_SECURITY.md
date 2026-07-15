# Segurança do webhook WhatsApp

## Risco original

`POST /ai-attendant/whatsapp/webhook` era público e processava eventos sem token, timestamp, limite específico ou deduplicação. Um atacante podia forjar ou repetir mensagens e disparar escrita de clientes, conversas e respostas da IA.

## Capacidade real do provedor

A Evolution API v2 documenta configuração de URL, eventos e base64, mas não documenta assinatura criptográfica ou headers customizados no callback. Portanto, este hardening não inventa HMAC incompatível.

## Proteção aplicada

- secret obrigatório `WHATSAPP_WEBHOOK_SECRET`;
- `x-webhook-token` ou `Authorization: Bearer` para gateways que injetam header;
- fallback compatível com Evolution: factory acrescenta `webhook_secret` à URL configurada;
- comparação em tempo constante por hashes SHA-256;
- `Content-Type: application/json` obrigatório;
- limite de 256 KiB no Fastify e verificação configurável no endpoint;
- timestamp obrigatório para eventos de mensagem, janela padrão de 300 segundos e tolerância futura de 60 segundos;
- somente eventos de mensagem conhecidos seguem para regras de negócio;
- `messageId` externo obrigatório;
- `WebhookReceipt` único por provedor, sessão e evento, gravado antes do negócio;
- mesmo ID com mesmo hash retorna sucesso duplicado; mesmo ID com outro conteúdo retorna conflito;
- rate limit por IP e loja;
- logs guardam metadados e telefone mascarado, não o corpo completo;
- query string é removida do path de erros para não ecoar o secret.

## Testes

- token ausente e inválido;
- timestamp expirado;
- payload excessivo;
- content type inválido;
- evento desconhecido;
- evento válido;
- replay idêntico;
- colisão de ID com conteúdo diferente;
- deduplicação persistida em PostgreSQL.

## Limitações e operação recomendada

- O token em query é a melhor opção diretamente suportada pela configuração documentada da Evolution, mas pode aparecer em configurações e access logs de proxies. Em produção, preferir um gateway que remova a query e injete `x-webhook-token`, com redação de logs.
- A Evolution não fornece assinatura criptográfica documentada; autenticidade continua inferior a um provedor com assinatura do corpo.
- Para futura WhatsApp Cloud API, manter a verificação na borda e trocar a estratégia por assinatura oficial sobre corpo bruto, sem alterar o pipeline de deduplicação.
- Rotacionar o secret se a URL completa tiver sido exposta.

## Variáveis

```text
WHATSAPP_WEBHOOK_SECRET
WHATSAPP_WEBHOOK_MAX_AGE_SECONDS=300
WHATSAPP_WEBHOOK_MAX_PAYLOAD_BYTES=262144
```
