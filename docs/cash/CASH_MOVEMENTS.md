# Movimentos de caixa

Movimentos sao imutaveis e representam somente eventos financeiros de dinheiro fisico.

## Labels de operador

- Valor inicial
- Venda em dinheiro
- Dinheiro adicionado
- Dinheiro retirado
- Reembolso
- Ajuste
- Diferenca no fechamento

## Tipos internos

- `OPENING_BALANCE`
- `CASH_SALE`
- `CASH_SUPPLY`
- `CASH_WITHDRAWAL`
- `CASH_REFUND`
- `CASH_ADJUSTMENT`
- `CLOSING_DIFFERENCE`

## Saldo esperado

Formula:

`valor inicial + vendas em dinheiro + dinheiro adicionado - dinheiro retirado - reembolsos em dinheiro +/- ajustes autorizados`

Nao entra no saldo fisico:

- Pix
- cartao
- boleto
- pagamentos pendentes
- pagamentos falhos
- pagamentos expirados

Cada movimento novo grava saldo antes e saldo depois.
