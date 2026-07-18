# Permissoes do caixa

O caixa reutiliza o RBAC existente:

- `cash:view`: caixa, movimentos e historico.
- `cash:manage`: abrir, adicionar, retirar, corrigir e fechar.
- `payments:confirm`: confirmar pagamento e reembolso do pedido.

## Aprovacao de retirada

Nao existe limite fixo. A loja pode configurar `cashWithdrawalApprovalThreshold`; acima dele, a API exige membership ativo e papel `owner`, `manager` ou `supervisor`.

O aprovador vem da autenticacao; o frontend nao envia `approvedByUserId`. Nesta versao, o gerente/supervisor/owner autenticado executa e aprova a retirada. Nao ha fila pendente em duas etapas.

Loja, operador, horario, saldo, diferenca e aprovador sao sempre definidos/validados pela API.
