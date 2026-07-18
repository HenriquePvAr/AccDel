# Caixa auditavel v2

O caixa v2 controla apenas dinheiro fisico. Pix, cartao e outros metodos aparecem no resumo financeiro, mas nao alteram o saldo fisico esperado.

## Componentes

- Terminal: caixa fisico por loja, como `Caixa principal`.
- Sessao: abertura, movimentos, fechamento e diferenca.
- Movimento: evento imutavel de entrada, retirada, venda, reembolso, ajuste ou diferenca.
- Pagamento/pedido: origem confirmada de venda ou reembolso.
- Auditoria: ator, horario, chave idempotente e saldos antes/depois.

## Regras

- Loja e operador vem da sessao autenticada.
- Frontend nao envia saldo, diferenca, horario, operador ou aprovador confiavel.
- Apenas uma sessao fica aberta por terminal.
- Movimentos nao sao editados nem apagados; correcao e compensatoria.
- Mutacoes exigem `Idempotency-Key`.
- Venda/reembolso em dinheiro so nascem de pagamento confirmado no backend.
- Pagamentos de pedido e mesa ficam vinculados ao caixa para o resumo por metodo.

## Migrations

- `apps/api/prisma/migrations/20260717190000_cash_register_v2/migration.sql`
- `apps/api/prisma/migrations/20260717203000_cash_register_v2_hardening/migration.sql`

A primeira cria terminais, campos auditaveis, ledger, auditoria e unicidade de sessao/idempotencia. O hardening adiciona integridade composta de tenant, vinculos de pagamentos/mesas, limite opcional de aprovacao, constraints monetarias, unicidade de eventos financeiros e triggers contra update/delete no ledger.

## Rollback

Em ambiente controlado: interromper mutacoes, preservar/exportar o ledger, remover triggers, FKs e indices novos, depois tabelas/colunas. Valores de enum PostgreSQL nao devem ser removidos automaticamente. Rollback destrutivo exige backup e aprovacao humana.
