# Meta WhatsApp Cloud API

Data: 14/07/2026

## Visao geral

A integracao principal usa a API oficial da Meta e o endpoint versionado `POST /{phone-number-id}/messages`. O provider legado Evolution permanece disponivel apenas com selecao explicita; nao existe fallback automatico nem processamento simultaneo.

Fontes oficiais consultadas:

- [Meta WhatsApp Business Platform](https://www.postman.com/meta/whatsapp-business-platform/overview)
- [Cloud API — Messages](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages)
- [Send Text Message](https://www.postman.com/meta/whatsapp-business-platform/request/8gvd47s/send-text-message)
- [Webhook Payload Reference](https://www.postman.com/meta/whatsapp-business-platform/folder/vzaxn16/webhook-payload-reference)
- [Exemplo oficial de validacao de assinatura](https://github.com/fbsamples/whatsapp-api-examples/tree/main/signature-validation-with-webhooks-payloads)

## Configuracao

Preencha as variaveis `WHATSAPP_*` de `apps/api/.env.example` e somente entao selecione `WHATSAPP_PROVIDER=cloud`. A API falha no startup se identificadores, token, verify token, App Secret, loja, versao da Graph API ou URL HTTPS estiverem ausentes/inseguros.

No Meta Business:

1. vincule o numero oficial e obtenha `phone_number_id` e `business_account_id`;
2. conceda ao token a permissao necessaria para mensageria;
3. configure a URL publica `https://SEU_HOST/webhooks/whatsapp`;
4. use o mesmo `WHATSAPP_VERIFY_TOKEN` no desafio de verificacao;
5. assine o campo `messages`;
6. mantenha `WHATSAPP_APP_SECRET` somente no ambiente da API.

## Endpoints

- `GET /webhooks/whatsapp`: valida `hub.mode`, `hub.verify_token` e devolve `hub.challenge`.
- `POST /webhooks/whatsapp`: aceita apenas JSON, exige `X-Hub-Signature-256` e valida HMAC-SHA256 sobre os bytes exatos do corpo bruto.

O tenant do webhook vem de `WHATSAPP_STORE_ID` e da correspondencia entre WABA/phone number id e `MessagingAccount`. Headers enviados pelo caller nunca escolhem a loja.

## Eventos e idempotencia

Mensagens e status sao normalizados antes de entrar no dominio. `InboundEvent` possui chave unica por conta/evento. Mensagens repetidas retornam sucesso sem recriar conversa, rascunho ou resposta.

Status `sent`, `delivered`, `read` e `failed` atualizam a outbox de forma monotona; webhooks atrasados nao fazem uma mensagem `READ` voltar para `DELIVERED`.

## Janela de 24 horas

Texto livre so e enfileirado quando houve mensagem do cliente nas ultimas 24 horas. Fora da janela, notificacoes usam template utility aprovado. Se o template correspondente nao estiver configurado, o envio falha fechado e fica auditavel.

## Compatibilidade

Para o legado, selecione `WHATSAPP_PROVIDER=evolution_api` e configure somente as variaveis da secao Evolution. A rota `/ai-attendant/whatsapp/webhook` responde 404 quando Cloud esta ativo. A interface Cloud nao mostra QR Code, restart ou disconnect de sessao local.

## Limitacoes honestas

- um timeout depois de a Meta aceitar a mensagem e antes da resposta chegar pode produzir incerteza externa; a idempotencia interna impede reexecucao local conhecida, mas a API da Meta nao recebe nossa chave interna;
- rate limit e loops de polling sao locais por processo; para escala horizontal, usar coordenacao distribuida/worker dedicado;
- o teste final com credenciais reais, numero oficial e templates aprovados precisa ser executado no ambiente do operador.
