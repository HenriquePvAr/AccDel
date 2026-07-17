# Máquina de estados de pedidos

## Status reais do domínio

O schema atual possui: `in_analysis`, `in_preparation`, `ready`, `out_for_delivery`, `completed` e `cancelled`.

## Transições permitidas

| Estado atual | Próximo estado | Ação | Condições |
|---|---|---|---|
| `in_analysis` | `in_preparation` | `accept` ou `start_preparation` | ator autorizado |
| `in_analysis` | `cancelled` | `cancel` | ator autorizado |
| `in_preparation` | `ready` | `ready` | cozinha ou operação autorizada |
| `in_preparation` | `cancelled` | `cancel` | ator autorizado |
| `ready` | `out_for_delivery` | `dispatch` | somente delivery; motoboy ativo da mesma loja; pagamento confirmado, exceto cash |
| `ready` | `completed` | `complete` | somente retirada/balcão/mesa; pagamento confirmado, exceto cash |
| `ready` | `cancelled` | `cancel` | ator autorizado |
| `out_for_delivery` | `completed` | `complete` | motoboy atribuído ou operação administrativa permitida |
| `out_for_delivery` | `cancelled` | `cancel` | somente owner, manager ou supervisor |

Uma repetição da mesma ação que já produziu o estado final é idempotente. Qualquer salto, regressão ou ação posterior a `completed`/`cancelled` é bloqueada.

## Regras por papel

- `driver`: apenas `complete`, e somente quando `actor.userId === order.driverId`.
- `kitchen`: `accept`, `start_preparation` e `ready`.
- demais papéis: precisam da permissão de rota; cancelamento em rota exige papel gerencial.
- `actor` não é mais aceito do body; nome e ID vêm da sessão autenticada.

## Concorrência e idempotência

- A atualização usa compare-and-set por `id + storeId + status atual`.
- Se outra requisição alterar o pedido primeiro, a segunda recebe conflito de domínio.
- Rotas críticas exigem `Idempotency-Key`; o resultado fica persistido por loja, ator e operação.
- Assignments e disponibilidade são sincronizados novamente em retries idempotentes.

## Pagamento

Pedidos nascem `pending`. O endpoint `PATCH /orders/:id/payment` aceita apenas `paid`, `failed`, `cancelled` ou `refunded`, usa o total calculado no servidor e grava `PaymentAudit`. `paid: true` não pertence ao DTO e é rejeitado.

Transições de pagamento:

```text
pending -> paid | failed | cancelled
failed  -> paid | cancelled
paid    -> refunded
cancelled/refunded -> terminal
```

## Testes

Os testes cobrem transições válidas e inválidas, salto direto, pedido concluído, driver errado, pagamento pendente, cancelamento em rota, idempotência e ciclo de pagamento.

## Limitações

- Não foi criado gateway de pagamento; confirmação é manual e exige `payments:confirm`.
- Cash pode avançar pendente porque o domínio atual representa pagamento na entrega/caixa.
- Falha/estorno ainda não gera ledger financeiro completo; apenas status, auditoria e movimento de venda confirmado.
