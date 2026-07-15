# Validação das migrations

## Inventário

Foram identificadas 23 migrations Prisma, ordenadas lexicograficamente de `20260423000000_initial_orders_catalog_cash` até `20260715052000_waiter_pwa_domain`. Os timestamps não retrocedem. As quatro últimas camadas são:

1. `20260714210000_critical_operational_hardening`
2. `20260714233000_whatsapp_cloud_ai_messaging`
3. `20260715003000_messaging_review_hardening`
4. `20260715035032_thermal_printing_system`
5. `20260715052000_waiter_pwa_domain`

O hardening do fluxo de mensageria ocupa duas migrations aditivas, por isso o banco na marca 19 recebe quatro diretórios de evolução até 23, embora represente hardening/mensageria, impressão e garçom.

## Matriz executada em PostgreSQL isolado

| Cenário | Estado inicial | Ação | Resultado |
| --- | ---: | --- | --- |
| A | 0 | deploy das 23 | PASS — 23 aplicadas |
| B | 19 | deploy 20–23 | PASS — dados preservados, 23 aplicadas |
| C | 21 | deploy impressão + garçom | PASS — dados preservados, 23 aplicadas |
| D | 22 | deploy garçom | PASS — dados preservados, 23 aplicadas |

Comando reproduzível, restrito por guardas a PostgreSQL local e banco com nome de teste:

```powershell
$env:MIGRATION_TEST_DATABASE_URL='<URL PostgreSQL local de teste obtida do runtime protegido>'
npm.cmd run staging:test:migrations
```

O script cria bancos temporários por cenário, aplica o prefixo solicitado, grava sentinelas de dados, aplica o restante, verifica sentinelas e contagem da tabela `_prisma_migrations`, e remove somente bancos com nome permitido.

## Revisão de schema

Foram verificadas foreign keys, índices de lookup/tenant/filas, defaults, colunas obrigatórias, constraints e dependências das novas tabelas. Não foi identificada migration que apague tabela/coluna ou exija truncamento dos dados existentes. A API só fica `ready` quando a contagem esperada é 23 e não há migration falha.

## Rollback

As migrations são forward-only. Nunca executar `migrate reset`, excluir diretórios já aplicados ou produzir `down` destrutivo. Em incidente: parar escrita, voltar o binário compatível ou desativar a feature, restaurar o backup pré-migration em um banco novo, validar e trocar a conexão. O banco original permanece preservado para investigação.
