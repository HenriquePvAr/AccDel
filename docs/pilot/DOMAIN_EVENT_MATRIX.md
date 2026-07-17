# Matriz oficial de eventos do domínio

Os estados reais de pedido são `in_analysis`, `in_preparation`, `ready`, `out_for_delivery`, `completed` e `cancelled`. Sessões de mesa usam `open`, `awaiting_close` e `closed`; pagamento usa `pending` e `paid` nas transições do piloto.

| Evento lógico | Origem autorizada | Antes | Depois | WhatsApp | Impressão | Realtime | Auditoria/idempotência |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pedido confirmado | API pública/admin/IA aprovada | inexistente/draft | `in_analysis` | Só com flags + provider + sandbox | `ORDER_INITIAL`, caixa/cliente conforme rotas | Sim | criação transacional + idempotency key |
| Produção iniciada | operação/cozinha | `in_analysis` | `in_preparation` | conforme política, desativado no piloto | rota de produção aplicável | Sim | state machine + timeline |
| Adição do garçom | PWA proprietária | sessão `open` | novo lote; sessão segue `open` | não por padrão | exatamente um `ORDER_ADDITION` | Sim | versão da sessão + chave idempotente |
| Pedido pronto | cozinha | `in_analysis`/`in_preparation` | `ready` | conforme política | exatamente um `DISPATCH_ORDER` | Sim | serviço oficial de pedidos; replay não duplica |
| Item entregue à mesa | garçom proprietário | item pronto/não entregue | `deliveredAt` preenchido | não | não | Sim | versão da sessão + ator |
| Fechamento solicitado | garçom proprietário | `open` | `awaiting_close` | não | não | Sim | versão da sessão |
| Pagamento confirmado | caixa/gerente/provedor autenticado | `pending` | `paid` | conforme política | `CASHIER_RECEIPT` e `CUSTOMER_RECEIPT` | Sim | transição única; corrida perde com conflito |
| Mesa encerrada | caixa/gerente com permissão | `awaiting_close` + pedidos pagos | `closed`; mesa livre | não | vias já criadas pelo pagamento | Sim | transação; apenas um vencedor |
| Motoboy atribuído | expedição/gerente | `ready` | `ready` + driver | conforme política | expedição já idempotente | Sim | tenant + permissão + assignment |
| Saiu para entrega | motoboy atribuído | `ready` | `out_for_delivery` | conforme política | conforme rota | Sim | somente `drivers:self` atribuído |
| Localização atualizada | motoboy atribuído | entrega ativa | entrega ativa | não | não | Sim | rate limit + idempotência + precisão pública reduzida |
| Entregue | motoboy atribuído | `out_for_delivery` | `completed` | conforme política | não por padrão | Sim | token público revogado |
| Cancelamento | usuário autorizado | estado cancelável | `cancelled` | conforme política | `ORDER_CANCELLATION` conforme rota | Sim | state machine + motivo + ator |

## Regra de emissão única

O commit do agregado ocorre antes de qualquer processamento assíncrono. Mensagens usam outbox persistente e chave lógica única; impressão usa chave de deduplicação/constraint, claim por lease e confirmação idempotente; PWA usa idempotency key e versão otimista; webhooks têm recibo deduplicado. Repetir a mesma requisição retorna o resultado persistido ou um conflito, sem criar um segundo evento lógico.

No cenário integrado, cada ordem gerou uma única via de cada tipo esperado. A ordem inicial gerou `ORDER_INITIAL`; o lote posterior gerou somente `ORDER_ADDITION`. Marcar pronto duas vezes não duplicou `DISPATCH_ORDER`.
