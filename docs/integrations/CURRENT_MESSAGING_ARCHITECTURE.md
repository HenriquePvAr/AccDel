# Arquitetura atual de mensagens e IA

Data do inventario: 14/07/2026
Base: `f04b335` (`security/critical-operational-hardening`)

Este documento registra o fluxo existente antes da integracao com a WhatsApp Cloud API e a NVIDIA. O objetivo e preservar comportamento real, identificar acoplamentos e tornar a migracao gradual e reversivel.

## Fluxo atual

```text
Evolution webhook
  -> POST /ai-attendant/whatsapp/webhook
  -> WebhookSecurityService (token, content type, tamanho e timestamp)
  -> WhatsappProviderFactory
  -> EvolutionApiWhatsappProvider.handleWebhook
  -> AiAttendantService.handleIncomingWebhook
  -> WebhookReceipt (deduplicacao)
  -> Customer / AiConversation / WhatsappMessage / AiMessage
  -> AiProviderFactory
  -> classificacao e resposta
  -> setTimeout em memoria
  -> provider.sendMessage
  -> persistencia posterior do resultado
```

## Componentes existentes

| Area | Implementacao atual | Observacao |
|---|---|---|
| WhatsApp | `WhatsappProviderAdapter` | Interface orientada a sessao web, QR code e texto; acoplada ao modelo da Evolution. |
| Provider | `EvolutionApiWhatsappProvider` | Cria instancia, configura webhook, consulta QR/status e envia texto. |
| Selecao | `WhatsappProviderFactory` | Escolhe apenas `evolution_api`; outro valor resulta em provider nao configurado. |
| Webhook | `AiAttendantController` | Um unico POST publico para Evolution, com token em header/Bearer/query. |
| Orquestracao | `AiAttendantService` | Concentra sessao, webhook, conversa, IA, rascunho, handoff, envio e logs. |
| IA | `AiProviderAdapter` | Retorna resposta estruturada e um rascunho sugerido pelo modelo. |
| Providers IA | Groq/OpenAI/OpenRouter/Lovable | Chamadas compativeis com Chat Completions, sem gateway NVIDIA dedicado. |
| Catalogo no prompt | `AiPromptBuilderService` | Consulta Prisma indiretamente por services, mas monta contexto amplo para o modelo. |
| Pedido | `AiOrderDraft` | Armazena sugestao; preparacao reconsulta produtos, mas a confirmacao continua manual no admin. |
| Envio | `sendDirectReply` | Chama o provider antes de persistir; nao existe outbox transacional persistente. |
| Atraso | `setTimeout` | Job em memoria; pode ser perdido em reinicio e nao possui claim concorrente. |
| Conversas | `AiConversation`/`AiMessage` | Suportam aberto, espera IA/humano, humano atribuido e fechado. |
| Interface | `/ai-attendant` | Ja possui lista, chat, assumir/devolver, falhas e rascunhos relacionados. |
| Tracking | `GET /orders/:id/tracking` | Endpoint autenticado/interno; nao deve ser exposto ao cliente. |
| Idempotencia | `IdempotencyRecord` e `WebhookReceipt` | Persistente; sera reutilizada no pipeline normalizado. |
| Rate limit | `RateLimitGuard` | Local por instancia; preservado na borda dos webhooks. |

## Riscos e lacunas

- o dominio recebe estruturas normalizadas pela Evolution, mas a interface ainda carrega semantica de sessao/QR;
- o webhook e o envio estao dentro do modulo monolitico `ai-attendant`;
- o envio ocorre antes da persistencia e pode divergir do banco em falhas;
- timers em memoria nao sobrevivem a reinicios;
- status de entrega nao possuem ordenacao monotona;
- mensagens de entrada, conversa, rascunho e resposta nao sao uma unica transacao;
- o modelo pode sugerir IDs, precos e rascunhos; a validacao existe na preparacao, mas nao ha allowlist de ferramentas executadas pelo backend;
- a tela permite atribuir uma conversa usando um `userId` recebido do cliente sem derivar o atendente da sessao;
- nao existe janela de atendimento central nem politica de templates;
- nao existe token publico opaco para tracking;
- o payload bruto pode ser armazenado em campos legados sem politica explicita de retencao.

## Arquitetura alvo e pontos substituidos

| Atual | Alvo | Estrategia |
|---|---|---|
| `WhatsappProviderAdapter` | `MessagingProvider` | Criar interface neutra; manter adaptador legado por compatibilidade. |
| POST Evolution | GET/POST Cloud dedicados | Cloud valida verify token e HMAC do corpo bruto; Evolution permanece em rota legada desativada por padrao. |
| `sendDirectReply` | `MessageOutbox` + worker | Persistir primeiro, claim atomico, retry/backoff e erro sanitizado. |
| `setTimeout` | `availableAt` na outbox | Processamento recuperavel e idempotente. |
| payload do provider no dominio | `NormalizedInboundMessage`/eventos | Formato Meta/Evolution fica restrito a adapters. |
| IA gera rascunho livre | `AiProvider` + allowlist de tools | Modelo pede ferramentas; backend valida tenant, cliente, tipos, precos e estado. |
| prompt amplo | prompt versionado + consultas pontuais | Catalogo e pedidos entram somente pelos resultados minimos das ferramentas. |
| estados legados | estados operacionais claros | Mapear para `AI_ACTIVE`, `WAITING_HUMAN`, `HUMAN_ACTIVE`, `PAUSED`, `CLOSED`. |
| tracking interno | `/tracking/:publicToken` | Token aleatorio hasheado, expiravel e revogavel; DTO publico minimo. |
| atualizacao manual isolada | eventos de pedido + politica | Transicoes validas geram no maximo uma notificacao na outbox, sem chamar IA. |

## Regra de migracao

`WHATSAPP_PROVIDER=cloud` sera o caminho principal. `evolution_api` continuara disponivel somente quando selecionado explicitamente; nao havera fallback automatico nem dois providers processando a mesma conta. A rota legada nao deve ficar exposta quando o provider ativo for Cloud.

