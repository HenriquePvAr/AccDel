# Cain Delivery - Estado atual do caixa

Data: 2026-07-17

Branch: `feat/cash-register-v2`

Base: `integration/commerce-communications-v1` em `b7b9f372b225bb7e671de4b6d6781a6d7639f82a`

## Objetivo

Registrar o estado real do caixa antes da implementacao v2, evitando duplicar modelos ou endpoints ja existentes.

## Resumo

O projeto ja possui um caixa v1 funcional com abertura, movimentos, fechamento, UI administrativa e vinculo basico com vendas. A base e reutilizavel, mas insuficiente para o caixa auditavel v2 porque nao possui terminal, identidade auditavel de operador/aprovador, idempotencia por operacao, movimentos imutaveis com saldo antes/depois, constraint de uma sessao aberta por terminal, nem regras fortes para impedir que Pix/cartao alterem saldo fisico.

## Models Prisma

### Reutilizavel

- `CashRegister`
- `CashMovement`
- `CashRegisterStatus`
- `CashMovementType`
- `PaymentMethod`
- `PaymentStatus`
- `PaymentAudit`
- `IdempotencyRecord`
- `Store`
- `User`
- `StoreUser`
- `Order`

### Parcial

- `CashRegister` representa hoje o caixa aberto/fechado, mas mistura a ideia de sessao e caixa/terminal.
- `CashMovement` registra o historico, mas ainda nao guarda:
  - `storeId` direto;
  - operador autenticado;
  - aprovador;
  - saldo antes;
  - saldo depois;
  - chave de idempotencia;
  - vinculo forte com pedido/pagamento;
  - movimento original para correcao compensatoria.
- `IdempotencyRecord` existe e pode ser reutilizado, mas o modulo de caixa ainda nao o usa.

### Ausente

- Modelo explicito de terminal/caixa fisico.
- Sessao de caixa separada de terminal.
- Auditoria de eventos de caixa.
- Constraint de uma sessao aberta por terminal.
- Indice unico de idempotencia por movimento de caixa.

### Requer migration

- Adicionar estrutura para terminais e sessoes auditaveis.
- Adicionar campos de auditoria/idempotencia/saldo/vinculos a movimentos.
- Preservar compatibilidade com registros antigos.

## Migrations

### Reutilizavel

- A migration inicial ja criou `cash_registers`, `cash_movements`, enums e indices basicos.
- A migration de hardening ja criou `idempotency_records`, que pode ser aproveitada.

### Inseguro/parcial

- Nao ha constraint banco-level para impedir duas sessoes abertas por terminal.
- Nao ha indice unico de idempotencia do caixa.
- Nao ha campos suficientes para trilha imutavel completa.

### Requer migration

- Migration aditiva, sem editar historico.
- Novos campos devem aceitar compatibilidade com dados antigos quando necessario.
- Dinheiro deve continuar em `Decimal(10, 2)`.

## Pagamentos, pedidos e metodos de pagamento

### Reutilizavel

- `PaymentMethod` ja diferencia `cash`, `pix`, `credit_card`, `debit_card`, `meal_voucher` e `payment_link`.
- `PaymentStatus` ja contem `paid`, `pending`, `failed`, `cancelled`, `refunded`.
- `PaymentAudit` registra eventos server-side.
- `OrdersService.confirmPayment` ja centraliza confirmacao manual de pagamento.

### Inseguro/parcial

- O fluxo legado `registerSaleMovement` incrementa o caixa para qualquer metodo pago, incluindo Pix/cartao.
- O fluxo legado de salao `registerDiningSale` tambem incrementa o caixa para qualquer metodo.
- Venda em dinheiro deve ser criada somente para `paymentMethod === 'cash'`.
- Pix/cartao/outros devem aparecer no resumo financeiro, mas nao alterar o saldo fisico esperado.

### Requer API

- Corrigir integracao de vendas para registrar movimento fisico apenas em dinheiro.
- Preservar resumo por metodo sem misturar saldo de dinheiro fisico.

## Operadores, usuarios e lojas

### Reutilizavel

- `AuthenticatedRequestUser` contem `sub`, `name`, `storeId`, `role` e `permissions`.
- `getCurrentStoreId()` resolve loja no contexto da requisicao autenticada.
- `StoreUser` vincula usuario a loja e papel.

### Parcial

- O caixa v1 persiste `operatorName`, mas nao `operatorId`.
- Movimentos manuais usam `userName: 'Operacao'`.

### Inseguro

- Frontend nao deve enviar `storeId`, operador, horario, saldo antes/depois ou diferenca.
- API deve derivar loja e operador da sessao autenticada.

### Requer API

- Persistir `openedByUserId`, `openedByName`, `closedByUserId`, `closedByName`, `operatorUserId`, `operatorName` e aprovador quando aplicavel.

## Terminais

### Ausente

- Nao ha modelo dedicado para terminal/caixa fisico.
- Nao ha `terminalId` no caixa v1.

### Requer migration

- Criar cadastro minimo de terminal por loja.
- Garantir nome/codigo unico por loja.
- Garantir somente uma sessao aberta por terminal.

## Permissoes

### Reutilizavel

- `cash:view`
- `cash:manage`
- RBAC existente por role.

### Parcial

- As acoes de abrir, adicionar, retirar, fechar e corrigir usam permissao ampla `cash:manage`.

### Requer API

- Reutilizar RBAC existente sem inventar novas permissoes se nao for necessario.
- Exigir `cash:manage` para acoes mutantes.
- Para aprovacao de retirada, aceitar gerente/administrador/owner quando houver politica configurada.

## Auditoria

### Reutilizavel

- Padroes existentes de `PaymentAudit`, `PrintAuditLog`, `AiExecution` e `AiToolCall` mostram como o projeto registra trilhas.

### Ausente

- Auditoria especifica de caixa.
- Registro de saldo antes/depois.
- Registro de request/idempotency key por operacao.
- Registro de aprovador.

### Requer migration e API

- Criar audit trail simples e queryable para caixa.

## Endpoints e services

### Reutilizavel

- `CashController`
- `CashService`
- `cash.contract.ts`
- Rotas atuais:
  - `GET /cash/register`
  - `POST /cash/register/open`
  - `POST /cash/register/movement`
  - `POST /cash/register/close`

### Parcial

- Rotas atuais podem ser mantidas por compatibilidade.
- O contrato atual e generico demais para a semantica v2.

### Requer API

- Adicionar rotas v2 sem quebrar rotas existentes:
  - abrir caixa;
  - adicionar dinheiro;
  - retirar dinheiro;
  - corrigir movimento;
  - fechar caixa;
  - historico;
  - movimentos.

## DTOs e contratos

### Reutilizavel

- Zod ja e usado para validacao.
- Contratos frontend/backend de caixa ja existem.

### Parcial

- `openCashRegisterSchema` so recebe `openingAmount`.
- `registerCashMovementSchema` aceita enum tecnico e label generico.
- `closeCashRegisterSchema` nao recebe observacao/justificativa.

### Requer API e interface

- Adicionar `terminalId`, `reason`, `note`, `approval`, `countedAmount`, `differenceReason` e `idempotencyKey` onde aplicavel.
- Nunca aceitar `storeId`, operador, horario, saldo ou diferenca do frontend.

## Tela Admin

### Reutilizavel

- `src/pages/CashRegisterPage.tsx`
- `CashSummaryCard`
- hooks React Query de caixa
- service `cashRegisterService`
- tipos de dominio de caixa

### Parcial

- UI ja mostra abertura, movimentos e fechamento.
- Ainda usa dialogos compactos e labels v1.
- Movimento manual ainda expõe tipos tecnicos indiretamente.
- Nao ha selecao de terminal.
- Nao ha fluxo de justificativa de diferenca.
- Nao ha historico/relatorio completo.

### Requer interface

- Redesenhar tela para desktop/tablet/mobile.
- Usar linguagem operacional:
  - Valor inicial;
  - Venda em dinheiro;
  - Dinheiro adicionado;
  - Dinheiro retirado;
  - Reembolso;
  - Ajuste;
  - Diferenca no fechamento.

## Testes existentes

### Reutilizavel

- Existem testes de idempotencia, seguranca, pedidos, pagamento e mensageria.
- Existem testes PostgreSQL de integracao em outros modulos.

### Ausente

- Suite dedicada para caixa.
- Teste de concorrencia de abertura.
- Teste de idempotencia de movimentos.
- Teste PostgreSQL de constraint de sessao aberta.
- Teste de isolamento entre lojas.
- Teste de Pix/cartao nao alterando saldo fisico.

### Requer testes

- Unitarios para dominio/calculo.
- Integracao PostgreSQL para constraints, transacoes, idempotencia e isolamento.

## Decisao de implementacao

- Reutilizar `CashRegister` como sessao historica compativel, adicionando campos de terminal/auditoria/idempotencia.
- Reutilizar `CashMovement`, adicionando dados imutaveis de saldo e vinculos.
- Criar modelo de terminal.
- Criar modelo de auditoria de caixa.
- Manter rotas antigas como superficie compativel e adicionar rotas v2 mais semanticas.
- Corrigir venda de pedido/salao para somente dinheiro fisico alterar saldo esperado.
- Criar testes dedicados antes do Draft PR.
