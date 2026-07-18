# Fechamento de caixa

O fechamento encerra uma sessao aberta e calcula a diferenca no backend.

## Campos

- dinheiro esperado
- dinheiro contado
- diferenca
- observacao
- justificativa de diferenca quando aplicavel
- operador autenticado
- horario do servidor

## Formula

`diferenca = dinheiro contado - dinheiro esperado`

## Regras

- Apenas caixa aberto pode ser fechado.
- Valor contado nao pode ser negativo.
- Fechamento usa transacao.
- Fechamento duplicado e bloqueado por status/idempotencia.
- Movimentos apos fechamento sao bloqueados.
- Diferenca diferente de zero exige justificativa enquanto nao existir tolerancia configuravel.

## Cenarios de homologacao

Base ficticia:

- Loja: Restaurante Laboratorio
- Terminal: Caixa principal
- Operadora: Sara Vale
- Abertura: R$ 150,00
- Venda em dinheiro: R$ 80,00
- Venda Pix: R$ 45,00
- Dinheiro adicionado: R$ 50,00
- Dinheiro retirado: R$ 30,00
- Reembolso em dinheiro: R$ 10,00

Saldo esperado: R$ 240,00.

Fechamentos a validar:

- R$ 240,00: diferenca zero
- R$ 235,00: diferenca negativa
- R$ 250,00: diferenca positiva
