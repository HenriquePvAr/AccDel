# Permissoes do caixa

O caixa v2 reutiliza o RBAC existente.

## Permissoes

- `cash:view`: visualizar caixa, movimentos e historico.
- `cash:manage`: abrir, adicionar dinheiro, retirar dinheiro, corrigir movimento e fechar.

## Aprovacao

Nao foi criado limite fixo de retirada. Quando existir configuracao de limite por loja, retiradas acima do limite devem exigir aprovador com papel:

- `owner`
- `manager`
- `supervisor`

## Regras de seguranca

- API valida permissao; a interface apenas oculta acoes.
- StoreId confiavel vem da sessao/contexto.
- Operador vem do usuario autenticado.
- Aprovador nao deve ser aceito cegamente do frontend sem politica de limite configurada.
