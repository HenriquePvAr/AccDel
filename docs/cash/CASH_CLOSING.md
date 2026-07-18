# Fechamento de caixa

O backend encerra a sessao e calcula `diferenca = dinheiro contado - dinheiro esperado`.

## Exibicao

- valor inicial e vendas por metodo
- dinheiro adicionado, retirado e reembolsado
- dinheiro esperado, contado e diferenca
- observacao, justificativa, operador e horario

## Regras

- Somente caixa aberto pode fechar.
- Valor contado nao pode ser negativo.
- Transacao usa isolamento `Serializable`.
- Retry e fechamento duplicado sao idempotentes/bloqueados.
- Movimento posterior ao fechamento e bloqueado.
- Diferenca nao zero exige justificativa enquanto nao houver tolerancia configurada.
- Venda, retirada e fechamento concorrentes usam status, saldo observado, constraint e retry.

## Homologacao ficticia

Restaurante Laboratorio, Caixa principal, Sara Vale: abertura R$ 150,00; venda cash R$ 80,00; Pix R$ 45,00; adicao R$ 50,00; retirada R$ 30,00; reembolso R$ 10,00; esperado R$ 240,00. Fechar com R$ 240,00, R$ 235,00 e R$ 250,00.
