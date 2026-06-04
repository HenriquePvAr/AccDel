# Evolution API no Cain Delivery

Este documento descreve a integracao real Cain Delivery -> Evolution API -> WhatsApp.

## Objetivo

O Atendente IA usa Evolution API como provider de WhatsApp receptivo:

- cria uma instancia da loja;
- gera QR Code real;
- consulta status da conexao;
- recebe webhooks de mensagens;
- envia respostas humanas ou da IA para conversas existentes;
- registra logs seguros no banco.

Nao existe QR Code fake no Cain Delivery. Sem provider configurado, a tela mostra estado honesto.

## Variaveis da API

Configure apenas em `apps/api/.env`:

```env
WHATSAPP_PROVIDER=evolution_api
WHATSAPP_PROVIDER_BASE_URL=http://localhost:8080
WHATSAPP_PROVIDER_API_KEY=
WHATSAPP_PROVIDER_WEBHOOK_URL=http://localhost:3333/ai-attendant/whatsapp/webhook
WHATSAPP_PROVIDER_INTEGRATION=WHATSAPP-BAILEYS
```

Notas:

- `WHATSAPP_PROVIDER_API_KEY` fica somente no backend NestJS.
- Nao use variaveis `VITE_` para token de WhatsApp.
- Para testar webhook fora da maquina local, exponha a API com uma URL publica segura e use essa URL em `WHATSAPP_PROVIDER_WEBHOOK_URL`.

## Evolution API

A Evolution API documenta:

- criacao de instancia em `POST /instance/create`;
- consulta de conexao em `GET /instance/connectionState/{instance}`;
- envio de texto em `POST /message/sendText/{instance}`;
- webhook em `POST /webhook/set/{instance}`.

Referencias oficiais consultadas:

- https://doc.evolution-api.com/v2/api-reference/instance-controller/create-instance-basic
- https://doc.evolution-api.com/v2/api-reference/instance-controller/connection-state
- https://doc.evolution-api.com/v2/api-reference/message-controller/send-text
- https://docs.evoapicloud.com/api-reference/webhook/set

## Fluxo de conexao

1. No Cain, abra `Atendente IA > WhatsApp`.
2. Clique em `Conectar WhatsApp`.
3. A API cria ou atualiza a instancia `session_store_main` na Evolution.
4. A API configura webhook se `WHATSAPP_PROVIDER_WEBHOOK_URL` estiver preenchida.
5. Clique/aguarde o QR Code real retornado por `/instance/connect/{instance}`.
6. Escaneie pelo WhatsApp da loja em `Aparelhos conectados`.
7. A tela faz polling de status e muda para conectado quando `connectionState` retornar `open`.

## Webhook

Endpoint Cain:

```text
POST /ai-attendant/whatsapp/webhook
```

Eventos recomendados na Evolution:

- `QRCODE_UPDATED`
- `MESSAGES_UPSERT`
- `MESSAGES_UPDATE`
- `SEND_MESSAGE`
- `CONNECTION_UPDATE`

O Cain normaliza mensagens inbound e salva:

- `WhatsappMessage`
- `AiMessage`
- `AiConversation`
- `WhatsappIntegrationLog`

Payloads brutos ficam restritos ao backend/banco. A UI exibe apenas detalhes seguros.

## Testes operacionais

### QR Code

1. Configure `WHATSAPP_PROVIDER_*`.
2. Rode a API.
3. Abra `Atendente IA > WhatsApp`.
4. Clique em `Conectar WhatsApp`.
5. Verifique se o QR Code exibido vem da Evolution.

### Recebimento

1. Com WhatsApp conectado, envie uma mensagem para o numero da loja.
2. Verifique `Atendente IA > Conversas`.
3. A conversa deve aparecer como real, com mensagem inbound e log `message_received`.

### Envio manual

1. Abra uma conversa existente.
2. Envie uma resposta humana.
3. O Cain assume a conversa, pausa a IA e chama `message/sendText`.

### IA automatica

1. Configure provider de IA no backend.
2. Ative modo `sugestao`, `automatico` ou `hibrido`.
3. Envie mensagem real pelo WhatsApp.
4. O pipeline salva inbound, monta prompt com catalogo real, gera resposta, aplica delay e envia se nenhum humano assumiu.

## Limites atuais

- O Cain cria pedido somente pelo fluxo de `Novo Pedido`. `orderDraft` prepara a tela, mas nao cria pedido automaticamente.
- A metrica `pedidos convertidos` ainda fica zerada ate existir vinculo persistido entre `AiOrderDraft` e o pedido criado no final do fluxo.
- A Evolution precisa estar acessivel pela API Cain e o webhook precisa conseguir chamar o backend.
- Webhook local em `localhost` funciona apenas se a Evolution roda na mesma maquina/rede com acesso ao backend.
