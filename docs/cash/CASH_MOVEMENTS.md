# Movimentos de caixa

Movimentos representam apenas eventos de dinheiro fisico.

## Labels do operador

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

`valor inicial + vendas em dinheiro + dinheiro adicionado - dinheiro retirado - reembolsos em dinheiro +/- ajustes autorizados`

Pix, cartao, boleto e pagamentos pendentes/falhos/expirados nao entram no saldo fisico.

Cada movimento grava saldo antes/depois. O banco bloqueia alteracao/exclusao direta; `CASH_ADJUSTMENT` referencia o movimento original.

## Pagamentos

- `CASH_SALE` exige pagamento cash confirmado e referencia pedido/pagamento.
- `CASH_REFUND` nasce da transicao para `refunded`, exige motivo e nao excede o recebido.
- Pix/cartao/outros sao vinculados ao caixa apenas para conciliacao.
