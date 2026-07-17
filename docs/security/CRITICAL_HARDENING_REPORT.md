# Relatório de hardening operacional crítico

## Escopo

Branch `security/critical-operational-hardening`, originada do redesign consolidado em `d7779ea`. Nenhuma integração oficial de WhatsApp, agente novo, impressão ou aplicativo novo foi implementado.

## Correções

| Risco | Solução | Evidência de teste |
|---|---|---|
| IDOR/abuso de driver | `drivers:self`, identidade do JWT, admin separado, tenant em queries | permissão negativa, driver A/B, tenant unitário e PostgreSQL |
| Webhook forjado/repetido | token, tempo constante, timestamp, body limit, rate limit e receipt único | token/timestamp/tamanho/replay/DB |
| Status arbitrário | máquina central por estado, papel, canal, pagamento e driver | matriz positiva/negativa |
| Repeat com valores históricos | extrai somente IDs/opções/quantidades e reconsulta catálogo, promoção e taxa | preço, item indisponível, adicional, desconto expirado e taxa |
| Mutações duplicadas | `Idempotency-Key` persistido por loja/ator/operação | replay unitário e PostgreSQL |
| Pagamento confiado | pedidos pendentes, endpoint autorizado e `PaymentAudit` server-side | `paid: true` rejeitado e ciclo de status |
| JWT fallback | segredo mínimo obrigatório, sem fallback conhecido | build e teste de token inválido/expirado |

## Arquivos e estruturas

- migrations aditivas: `IdempotencyRecord`, `WebhookReceipt`, `PaymentAudit` e novos estados de pagamento;
- segurança compartilhada em `apps/api/src/shared/security`;
- políticas de pedido em `apps/api/src/modules/orders`;
- hardening de driver em auth/controller/service;
- hardening de webhook no módulo `ai-attendant`;
- clientes web/driver enviam chave idempotente em mutações;
- contratos e labels web reconhecem os estados de pagamento adicionais.

## Resultados registrados

- 25 testes unitários da API: aprovados;
- 1 teste de integração PostgreSQL: aprovado;
- migration completa em banco embutido isolado: 19/19 aplicadas;
- build e lint da API: aprovados após as correções de tipo;
- baseline anterior: build/lint web, 5 testes web, build/lint API e lint/typecheck driver aprovados.

## Limitações e riscos restantes

- rate limit em memória não é compartilhado entre réplicas;
- JWT não possui refresh/revogação global nem revalidação de membership em todos os módulos;
- tracking público por UUID ainda precisa de token opaco;
- query secret da Evolution é uma compatibilidade inferior a assinatura criptográfica;
- falta ledger financeiro completo e webhook de provedor de pagamento;
- falta CI com secret scan/SCA e testes E2E por papel;
- idempotência precisa de limpeza periódica de registros expirados em operação longa;
- dependências sinalizadas no audit original não foram atualizadas nesta etapa para evitar misturar supply chain com regras críticas.

## Próxima etapa recomendada

1. configurar secret manager, gateway do webhook e rate limit distribuído;
2. implementar sessão JWT curta, refresh rotativo e revogação;
3. proteger tracking público com token opaco expirável;
4. adicionar ledger/payment provider autenticado sem criar gateway novo nesta branch;
5. executar E2E por papel e concorrência em CI com PostgreSQL e scanner de secrets.
