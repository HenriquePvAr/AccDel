# Cain Delivery - Auditoria Commerce & Communications V1

Data: 2026-07-17

Branch de trabalho: `integration/commerce-communications-v1`

Base auditada: `main` apos merge do RC2, HEAD `51ed8101278844cae822e4b69fc3c8fd2c43d462`

## Objetivo

Mapear o estado real do Cain Delivery antes de iniciar o ciclo RC3 de comercio e comunicacao, sem alterar regras funcionais nesta branch de integracao.

Esta auditoria separa o que ja esta implementado, parcialmente implementado, ausente, inseguro, duplicado, legado e pronto para reutilizar. O resultado deve orientar as branches:

- `feat/cash-register-v2`
- `feat/payment-platform`
- `feat/whatsapp-cloud-hardening`
- `feat/ai-attendant-v2`

## Premissas e limites

- Nenhum fluxo de dinheiro real deve ser acionado nesta etapa.
- Nenhum envio real via WhatsApp Cloud deve ser feito nesta etapa.
- Nenhuma credencial, CPF, telefone real, endereco real, dado de cartao ou PII deve ser inserido em testes ou documentacao.
- Esta branch de integracao deve receber apenas planejamento, consolidacao e merges revisados das branches de feature.
- Implementacoes funcionais devem ocorrer em branches separadas, com PR draft para esta branch de integracao, nunca diretamente para `main`.

## Validacao inicial da base

Comandos de referencia executados antes da criacao desta auditoria:

- `git status --short`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git diff --check`
- `git fsck --full`
- `git remote -v`
- `git ls-remote origin refs/heads/main`
- `gh pr view 1 --json number,state,mergeCommit,url`

Resultado observado:

- Branch inicial: `main`
- HEAD local: `51ed8101278844cae822e4b69fc3c8fd2c43d462`
- `origin/main`: `51ed8101278844cae822e4b69fc3c8fd2c43d462`
- Worktree: limpa
- `git diff --check`: sem erros
- PR #1: `MERGED`
- Merge commit do PR #1: `51ed8101278844cae822e4b69fc3c8fd2c43d462`
- `git fsck --full`: sem corrupcao reportada; apenas objetos dangling locais
- Portas verificadas para ambiente temporario: sem listeners relevantes
- Processos temporarios do projeto: nenhum processo residual relevante encontrado

## Matriz executiva

| Area | Estado atual | Risco principal | Proxima branch |
| --- | --- | --- | --- |
| Caixa | Parcialmente implementado | Concorrencia, idempotencia e trilha operacional ainda insuficientes para caixa v2 | `feat/cash-register-v2` |
| Pagamentos | Parcialmente implementado | Falta uma plataforma transacional provider-neutral antes de integracoes reais | `feat/payment-platform` |
| WhatsApp Cloud | Parcialmente implementado | Duas geracoes convivem: modulo novo de messaging e legado Evolution/AI attendant | `feat/whatsapp-cloud-hardening` |
| IA atendente | Parcialmente implementado | Falta suite deterministica de avaliacao e endurecimento explicito contra prompt injection | `feat/ai-attendant-v2` |
| Observabilidade | Parcialmente implementado | Eventos existem em partes, mas faltam metricas e paineis integrados para operacao | branches de cada area |
| Documentacao | Parcialmente implementada | Documentos existem, mas precisam virar guias operacionais RC3 | branches de cada area |

## Caixa

### Ja implementado

- Entidades Prisma:
  - `CashRegister`
  - `CashMovement`
  - `CashRegisterStatus`
  - `CashMovementType`
- Tabelas e indices de caixa ja existem via migracao inicial.
- API Nest em `apps/api/src/modules/cash`:
  - `GET /cash/register`
  - `POST /cash/register/open`
  - `POST /cash/register/movement`
  - `POST /cash/register/close`
- Permissoes:
  - `cash:view`
  - `cash:manage`
- Abertura impede caixa aberto duplicado por busca de caixa `open` da loja.
- Movimentos manuais suportados:
  - `supply`
  - `withdrawal`
  - `adjustment`
  - `refund`
- Vendas de pedidos e atendimento de mesa/comanda ja possuem caminhos que registram movimentos de venda no caixa.
- UI administrativa existe em `src/pages/CashRegisterPage.tsx`.
- Componentes/queries/tipos de caixa ja existem no frontend.

### Parcialmente implementado

- O controle de caixa e funcional, mas ainda e um caixa v1 operacional.
- A abertura de caixa faz validacao aplicacional, mas nao foi identificado bloqueio transacional/constraint especifica para impedir corrida concorrente de dois operadores abrindo caixa ao mesmo tempo.
- O operador e persistido como nome textual, nao como identidade auditavel completa do usuario autenticado.
- O fechamento calcula diferenca, mas ainda nao ha fluxo explicito de justificativa, aprovacao ou politica de tolerancia.
- A sangria/suprimento exige motivo na UI, mas a regra de negocio ainda e generica e nao diferencia claramente aprovacao, limite, responsavel e origem.
- O movimento `adjustment` nao altera o esperado, mas ainda precisa de politica clara de quando pode existir e como e auditado.
- O caixa nao parece separado por terminal/POS/dispositivo.
- Nao foi identificada suite dedicada de testes do modulo de caixa v2.

### Ausente

- Idempotency key para abertura, movimentacao e fechamento.
- Transacao explicita envolvendo leitura do caixa atual e escrita de movimentos em todos os fluxos criticos.
- Constraint ou estrategia de lock para no maximo um caixa aberto por loja/terminal conforme regra escolhida.
- Trilha de auditoria imutavel para cada decisao operacional.
- Modelo claro de operador, aprovador e terminal.
- Politica de sangria:
  - motivo obrigatorio server-side;
  - limite;
  - aprovacao;
  - comprovante/auditoria.
- Politica de fechamento:
  - contagem;
  - diferenca;
  - justificativa;
  - aprovacao por gerente quando necessario.
- Relatorios de conciliacao por periodo, operador, metodo e movimento.

### Inseguro ou fraco

- Concorrencia de abertura e fechamento ainda depende demais de verificacao aplicacional.
- `registerMovement` registra `userName: 'Operacao'`, sem amarrar ao usuario autenticado.
- O metodo de movimento de venda/estorno manual usa `pix` como default em parte do fluxo manual, o que pode gerar classificacao financeira imprecisa.
- Falta uma politica explicita para impedir movimentos financeiros ambiguos ou duplicados.

### Duplicado ou legado

- Nao foi identificada duplicacao estrutural relevante de caixa.
- Ha coexistencia entre dados reais da API e stores/mocks/frontend que deve ser revisada para nao mascarar o comportamento real em testes.

### Pronto para reutilizar

- Entidades Prisma atuais.
- Mapper e contratos de caixa.
- Rotas e permissoes existentes.
- UI `CashRegisterPage`.
- Integracao basica de movimentos de venda vindos de pedidos/mesas.

## Pagamentos

### Ja implementado

- Enum Prisma:
  - `PaymentMethod`
  - `PaymentProvider`
  - `PaymentStatus`
- `PaymentStatus` ja inclui estados alem de pago/pendente:
  - `paid`
  - `pending`
  - `failed`
  - `cancelled`
  - `refunded`
- Configuracao de metodos de pagamento:
  - `PaymentMethodConfig`
  - pagina `src/pages/PaymentSettingsPage.tsx`
  - contratos/settings no frontend e backend
- Auditoria de pagamento:
  - `PaymentAudit`
- Recebimento idempotente de webhook:
  - `WebhookReceipt`
- Documentacao de hardening de pagamentos e webhooks em `docs/security`.
- Endpoint de status de pagamento de pedido endurecido por hardening anterior, com auditoria server-side.

### Parcialmente implementado

- Ha configuracao e auditoria, mas ainda nao ha uma plataforma de pagamento completa.
- O pagamento ainda parece orientado principalmente ao pedido e a configuracao de metodos, nao a uma entidade transacional independente.
- Providers atuais no dominio visivel sao `manual`, `pix` e `picpay`, mas nao ha contrato provider-neutral completo.
- O projeto possui base para webhook receipt e payment audit, mas falta pipeline de pagamento com status externo, provider event, reconciliacao e refund/cancelamento reais.

### Ausente

- Entidade `PaymentTransaction` ou equivalente provider-neutral.
- Interface unica de provider com capacidades como:
  - criar cobranca;
  - consultar status;
  - cancelar;
  - estornar;
  - validar webhook;
  - normalizar eventos;
  - declarar capacidades do provider.
- Provider mock/sandbox deterministico para CI.
- Webhook especifico de pagamentos desacoplado do pedido.
- Conciliacao por evento externo, valor, moeda, metodo, pedido e provider.
- Comparativo tecnico formal entre provedores antes de qualquer integracao real.
- Politica de nao armazenar dados sensiveis de cartao no dominio local.

### Inseguro ou fraco

- Integrar provider real agora seria prematuro: a base ainda precisa de contrato provider-neutral e sandbox.
- Sem uma entidade transacional, eventos externos podem ficar acoplados demais ao pedido.
- Falta explicitar no dominio a diferenca entre configuracao de metodo, tentativa de pagamento, captura, falha, cancelamento, estorno e conciliacao.

### Duplicado ou legado

- Nao foi identificado modulo duplicado de pagamento completo.
- Ha sobreposicao conceitual entre `PaymentMethodConfig`, `PaymentAudit`, `WebhookReceipt` e status do pedido que precisa ser organizada na plataforma.

### Pronto para reutilizar

- `PaymentMethodConfig`
- `PaymentAudit`
- `WebhookReceipt`
- Enums de pagamento
- UI de configuracao de pagamentos
- Hardening previo do endpoint de status de pagamento

## WhatsApp Cloud

### Ja implementado

- Modulo novo `apps/api/src/modules/messaging`.
- Entidades Prisma para mensageria, contas, identidades, outbox, inbound events e logs.
- Provider kind para:
  - `whatsapp_cloud`
  - `evolution_legacy`
- Webhook Cloud em `webhooks/whatsapp`.
- Verificacao oficial de assinatura `x-hub-signature-256` usando HMAC SHA-256 sobre `rawBody`.
- Validacao de desafio `hub.verify_token`.
- Limite de tamanho de payload e content-type.
- Rate limit no webhook.
- Normalizador para payloads da Meta.
- Outbox e processamento com politica de sandbox.
- Testes de assinatura, payload, normalizacao, janela de 24h, sandbox, telefone e backoff.
- Documentos em `docs/integrations` sobre arquitetura e rollout de mensageria.

### Parcialmente implementado

- O modulo novo de messaging ja cobre grande parte do caminho certo, mas ainda convive com o legado dentro de `ai-attendant`.
- A configuracao segura por loja existe conceitualmente nas entidades, mas precisa de revisao de UX, criptografia, mascaramento e lifecycle operacional.
- O outbox existe, mas precisa ser revisado contra limites reais da Meta, templates aprovados, retry, DLQ operacional e visibilidade no Admin.
- A janela de 24h aparece em testes, mas precisa estar claramente refletida em dominio, UI e docs operacionais.

### Ausente

- Plano de corte definitivo entre `evolution_legacy` e `whatsapp_cloud`.
- UI operacional completa para estado de conta, webhook, templates, outbox, erros e sandbox.
- Guia final de setup Cloud API por loja, sem credenciais reais.
- Validacao fim-a-fim com payloads fake da Meta e sem envio externo.
- Politica de templates:
  - aprovacao;
  - idioma;
  - variaveis permitidas;
  - fallback para atendimento humano.

### Inseguro ou fraco

- A coexistencia entre webhook/receipt/security legado e novo modulo aumenta risco de caminho errado ser usado em producao.
- Qualquer envio real deve permanecer bloqueado ate a configuracao por loja, sandbox e observabilidade estarem fechadas.
- A nomenclatura de provider ainda precisa ser padronizada para reduzir erro operacional entre `cloud`, `whatsapp_cloud`, `evolution_api` e `evolution_legacy`.

### Duplicado ou legado

- Legado identificado:
  - `apps/api/src/modules/ai-attendant/evolution-api-whatsapp.provider.ts`
  - `apps/api/src/modules/ai-attendant/webhook-security.service.ts`
  - `apps/api/src/modules/ai-attendant/webhook-receipt.service.ts`
  - factory antiga de WhatsApp em `ai-attendant`
- Novo caminho preferencial:
  - `apps/api/src/modules/messaging`

### Pronto para reutilizar

- Verificacao HMAC Cloud.
- Normalizador Cloud.
- Inbound event ingress.
- Outbox.
- Politica de sandbox.
- Testes de hardening de mensageria.
- Docs de arquitetura de mensageria.

## IA atendente

### Ja implementado

- Modulo `apps/api/src/modules/ai-attendant`.
- Providers:
  - NVIDIA;
  - OpenAI-compatible;
  - Lovable backend;
  - unconfigured fallback.
- Gateway NVIDIA com:
  - timeout;
  - limite de concorrencia;
  - limite de requisicoes por minuto;
  - retry controlado;
  - circuit breaker;
  - testes para retry/circuit breaker sem vazar payload.
- Prompt builder e prompt especifico para atendimento WhatsApp.
- Processador Cloud AI.
- Registry de tools com schemas Zod estritos.
- Rejeicao de tools nao permitidas.
- Limite de tamanho de argumentos.
- Deduplicacao canonica de tool mutante na mesma execucao.
- Teste que rejeita tenant vindo do modelo antes de executar tool.
- Tools de cardapio, rascunho de pedido, entrega, confirmacao, status e handoff humano.
- Auditoria de execucoes e tool calls via entidades Prisma.

### Parcialmente implementado

- A IA ja tem base robusta, mas ainda precisa virar AI attendant v2 com avaliacao deterministica.
- Confirmacao explicita de pedido existe em testes, mas precisa ser expandida para matriz de conversas.
- Handoff existe, mas precisa ser fechado como fluxo operacional completo no Admin.
- A memoria/conversa existe, mas precisa de politica clara de retencao, sumarizacao e minimizacao.
- A IA usa tools para pedido, mas ainda falta suite explicita contra prompt injection e tentativa de extrapolar poderes.

### Ausente

- `FakeAIProvider` deterministico para CI e avaliacao.
- Suite de avaliacao com cenarios:
  - pedido simples;
  - item indisponivel;
  - alteracao de endereco;
  - pagamento ambiguo;
  - cliente irritado;
  - tentativa de prompt injection;
  - tentativa de obter dados internos;
  - tentativa de executar acao financeira;
  - pedido de cancelamento;
  - handoff obrigatorio.
- Politica explicita de memoria curta, memoria resumida e retencao.
- Taxonomia de razoes de handoff.
- Painel operacional de conversas em risco.
- Guardrails especificos para impedir a IA de criar, alterar ou prometer eventos financeiros fora das tools autorizadas.

### Inseguro ou fraco

- Sem avaliacao deterministica, regressao de prompt e tools pode passar despercebida.
- O prompt atual deve ser tratado como camada auxiliar, nao como controle de seguranca.
- A seguranca deve permanecer nas tools, no dominio e nos contratos.
- A convivencia com provider WhatsApp legado aumenta o risco de acoplamento indevido.

### Duplicado ou legado

- Parte do fluxo antigo de WhatsApp ainda vive dentro de `ai-attendant`, enquanto a arquitetura nova vive em `messaging`.
- A branch AI v2 deve evitar expandir o legado e preferir consumir o pipeline novo.

### Pronto para reutilizar

- `AiToolRegistry`
- `AiToolService`
- `AiConversationRepository`
- Prompt builder atual
- Gateway NVIDIA
- Testes de registry e gateway
- Entidades `AiConversation`, `AiMessage`, `AiExecution`, `AiToolCall`, `AiOrderDraft`

## Observabilidade

### Ja implementado

- Existem logs e entidades de auditoria em areas criticas:
  - payment audit;
  - webhook receipt;
  - integration logs;
  - AI executions;
  - AI tool calls;
  - messaging statuses.
- O projeto ja possui hardening previo de seguranca e documentacao de ordem/pagamento/webhook.

### Parcialmente implementado

- Observabilidade existe em nivel de eventos, mas ainda nao em nivel de operacao diaria completa.
- Falta correlacao clara entre pedido, pagamento, caixa, mensagem e atendimento IA.

### Ausente

- Dashboard operacional unificado para RC3.
- Metricas de:
  - abertura/fechamento de caixa;
  - diferencas de caixa;
  - falhas de pagamento;
  - webhooks duplicados/rejeitados;
  - outbox atrasado;
  - handoffs;
  - circuit breaker;
  - tool calls rejeitadas.
- Runbook de incidentes para cada area.

## Documentacao

### Ja implementado

- Documentos relevantes ja existem em:
  - `docs/security`
  - `docs/integrations`
  - blueprints administrativos

### Parcialmente implementado

- A documentacao atual e boa como historico tecnico, mas precisa ser convertida em guias operacionais por modulo RC3.

### Ausente

- `docs/operations/CASH_REGISTER_V2.md`
- `docs/operations/PAYMENT_PLATFORM.md`
- `docs/integrations/WHATSAPP_CLOUD_HARDENING.md`
- `docs/operations/AI_ATTENDANT_V2.md`
- Runbooks por incidente.
- Matriz de flags/env vars por modulo.

## Plano recomendado de branches

### 1. `feat/cash-register-v2`

Escopo recomendado:

- Idempotencia e transacoes nos fluxos criticos.
- Constraint/lock para caixa aberto.
- Usuario autenticado e terminal.
- Politicas de sangria, suprimento, ajuste e fechamento.
- Testes unitarios/integracao de concorrencia e duplicidade.
- Documentacao operacional de caixa.

Nao fazer:

- Integrar pagamento real.
- Criar migracao destrutiva.
- Alterar historico de migracoes antigas.

### 2. `feat/payment-platform`

Escopo recomendado:

- Criar dominio transacional provider-neutral.
- Criar provider mock/sandbox.
- Criar comparativo tecnico de provedores antes de provider real.
- Separar configuracao, tentativa, evento externo, conciliacao e auditoria.
- Testar webhook fake sem dinheiro real.

Nao fazer:

- Chamar provedor real.
- Armazenar dados sensiveis de cartao.
- Fazer `npm audit fix`.

### 3. `feat/whatsapp-cloud-hardening`

Escopo recomendado:

- Consolidar Cloud API como caminho principal.
- Reduzir/encapsular legado Evolution.
- Padronizar nomes de provider.
- Fechar sandbox, templates, janela de 24h, outbox e observabilidade.
- Testar apenas com payloads fake e sem envio externo.

Nao fazer:

- Enviar mensagem real.
- Inserir telefone real.
- Expor tokens em docs/testes.

### 4. `feat/ai-attendant-v2`

Escopo recomendado:

- Criar `FakeAIProvider`.
- Criar suite deterministica de avaliacao.
- Fortalecer prompt injection tests.
- Formalizar memoria, handoff e limites de tools.
- Integrar AI ao pipeline novo de messaging sempre que possivel.

Nao fazer:

- Usar NVIDIA real.
- Dar poderes financeiros diretos a IA.
- Permitir que prompt substitua validacao de dominio.

## Criterios para RC3

RC3 so deve ser considerado pronto quando:

- Cada branch tiver PR draft para `integration/commerce-communications-v1`.
- Cada branch tiver testes proporcionais ao risco.
- Nenhum PR fizer merge direto em `main`.
- Nenhum provider real for acionado.
- Nenhum dado sensivel real estiver em fixtures, docs ou logs.
- A integracao consolidada estiver validada localmente e no CI.
- O merge final para `main` depender de autorizacao humana explicita.

## Decisao tecnica desta auditoria

Status: aprovado para iniciar desenvolvimento incremental em branches separadas.

Classificacao:

- Caixa: base reutilizavel, precisa v2 antes de piloto operacional serio.
- Pagamentos: base parcial, precisa plataforma provider-neutral antes de provider real.
- WhatsApp Cloud: base forte, precisa consolidacao e limpeza de legado.
- IA atendente: base forte, precisa avaliacao deterministica e guardrails v2.
- Integracao: deve acontecer via `integration/commerce-communications-v1`, preservando `main`.
