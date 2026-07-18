# Conciliacao de caixa

O Admin consulta por periodo, operador, terminal, status e presenca de diferenca.

Cada linha mostra abertura, fechamento, duracao, operador, valor inicial, vendas por metodo, adicoes, retiradas, reembolsos, esperado, contado, diferenca e status. Todas as consultas usam o tenant autenticado.

## Limites

- Sem exportacao nesta branch.
- Consulta limitada a 100 sessoes; paginacao fica para evolucao posterior.
- Pagamentos anteriores ao campo `cash_register_id` dependem dos movimentos legados disponiveis.
