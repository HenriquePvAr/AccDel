# Plano de testes do caixa v2

## Unitarios

Cobertos em `apps/api/src/modules/cash/cash-domain.test.ts`:

- saldo esperado com abertura, venda dinheiro, Pix, suprimento, retirada e reembolso
- Pix/cartao nao alteram saldo fisico
- retirada/reembolso/ajuste negativo reduzem saldo
- suprimento/ajuste positivo aumentam saldo
- valor negativo rejeitado
- diferenca de fechamento exige justificativa quando diferente de zero

## PostgreSQL

Arquivo: `apps/api/src/modules/cash/cash-register.integration.test.ts`

Roda apenas com `RUN_DB_INTEGRATION=1`, seguindo o padrao do projeto.

Valida:

- constraint de uma sessao aberta por terminal
- idempotencia persistente de movimento por register/key

## Regressao manual recomendada

Usar apenas dados ficticios:

- Restaurante Laboratorio
- Caixa principal
- Sara Vale
- abertura R$ 150,00
- venda dinheiro R$ 80,00
- venda Pix R$ 45,00
- suprimento R$ 50,00
- retirada R$ 30,00
- reembolso R$ 10,00
- fechamento R$ 240,00, R$ 235,00 e R$ 250,00

Validar desktop, tablet e mobile.
