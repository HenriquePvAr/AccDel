# Conciliacao de caixa

A conciliacao do caixa v2 separa dinheiro fisico de outros metodos.

## Consultas

A API disponibiliza historico de sessoes com filtros conceituais para:

- periodo
- operador
- terminal
- status
- diferenca

## Campos do relatorio

- abertura
- fechamento
- duracao
- valor inicial
- vendas por metodo
- dinheiro adicionado
- dinheiro retirado
- reembolsos
- saldo esperado
- saldo contado
- diferenca
- status

## Limites atuais

- Exportacao externa nao foi implementada nesta branch.
- Painel de conciliacao ainda usa historico recente no Admin.
- Filtros avancados podem ser expandidos sem alterar o modelo financeiro.
