# Caixa auditavel v2

O caixa v2 controla apenas dinheiro fisico. Pix, cartao e outros metodos aparecem em resumo financeiro, mas nao alteram o saldo fisico esperado.

## Componentes

- Terminal: caixa fisico por loja, como `Caixa principal`.
- Sessao de caixa: abertura, movimentos, fechamento e diferenca.
- Movimento: registro imutavel de entrada, retirada, venda em dinheiro, reembolso, ajuste ou diferenca.
- Auditoria: trilha de quem fez, quando fez, idempotency key e saldo antes/depois.

## Regras principais

- A loja vem da sessao autenticada.
- Operador vem da sessao autenticada.
- O frontend nao envia saldo, diferenca, horario ou operador confiavel.
- Apenas uma sessao pode ficar aberta por terminal.
- Movimentos nao sao editados nem apagados.
- Correcao deve ser compensatoria.
- Mutações exigem `Idempotency-Key`.

## Migration

Migration: `apps/api/prisma/migrations/20260717190000_cash_register_v2/migration.sql`

Ela e aditiva e cria:

- `cash_terminals`
- campos auditaveis em `cash_registers`
- campos auditaveis em `cash_movements`
- `cash_audit_logs`
- indice unico parcial para uma sessao aberta por terminal
- indice unico parcial para movimentos idempotentes

Rollback recomendado em ambiente controlado: remover primeiro FKs/indices novos, depois tabelas novas, depois colunas adicionadas. Nao remover valores de enum PostgreSQL em rollback automatico; documentar reversao logica.
