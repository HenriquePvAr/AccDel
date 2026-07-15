# Matriz de CI

## Checks obrigatórios

| Workflow / job | Install | Build/export | Lint | Typecheck | Testes obrigatórios | Timeout |
|---|---|---|---|---|---|---:|
| `CI / Admin` / `admin` | raiz | Admin | sim | pelo build | 5 unitários | 20 min |
| `CI / API` / `api-unit` | `apps/api` | API + Prisma | sim | pelo build | 65 unitários | 25 min |
| `CI / API` / `api-postgres` | `apps/api` | Prisma | não repete | não repete | migrations 0 → 23 + 6 integrações PostgreSQL | 35 min |
| `CI / Waiter PWA` / `waiter` | `apps/waiter-app` | PWA | sim | `tsc --noEmit` | 14 unitários + 19 Playwright | 30 min |
| `CI / Print Agent` / `print-agent` | `apps/print-agent` | agente | sim | script `typecheck` | 10 testes seguros | 20 min |
| `CI / Driver App` / `driver` | `apps/driver-app` | export Android offline | sim | script `typecheck` | sem suíte unitária existente | 25 min |

Todos os jobs usam Node `24.16.0`, npm pelo runtime instalado, `npm ci`, cache separado por lockfile v3 e `ubuntu-24.04`.

## Cobertura PostgreSQL

| Cenário | CI | Evidência |
|---|---|---|
| Banco de integração 0 → 23 | obrigatório | `prisma migrate deploy` |
| Isolamento, idempotência e deduplicação | obrigatório | `security.integration.test.ts` |
| Concorrência de outbox/handoff | obrigatório | `messaging-hardening.integration.test.ts` |
| Impressão, replay, claim, lease e tenant | obrigatório | `printing.integration.test.ts` |
| Simulação de 40 pedidos | obrigatório | `printing.integration.test.ts` |
| Carga de 500 PrintJobs | obrigatório | `printing.integration.test.ts` |
| Fluxo de salão de domínio | obrigatório | `waiter.integration.test.ts` |
| Matriz incremental 0/19/21/22 → 23 | laboratório | o script seleciona Compose no runner com Docker e exige runtime local protegido |
| Salão e delivery completos com API/agent | laboratório | `staging:test:flows` exige serviços e seed piloto |
| Backup/restore lógico completo | laboratório | exige banco marcado `PILOT_DEMO_DATA` |
| `pg_dump`/`pg_restore` nativo | laboratório físico | depende de ferramentas, armazenamento e política reais |

O PostgreSQL do CI usa apenas dados fictícios e é destruído com o runner. Meta, NVIDIA, banco de produção e hardware não participam dos checks.

## Artefatos

Somente o Waiter envia artefatos, e apenas em falha:

- relatório HTML do Playwright;
- screenshots de falha;
- traces de falha.

A retenção é de sete dias. Outputs de build, bancos, backups, vídeos e `node_modules` não são enviados.

## Gates de laboratório

CI verde não substitui:

- checklist de hardware/rede;
- impressora ESC/POS real e spooler Windows;
- celulares/tablets reais;
- backup nativo e restore em destino novo;
- teste de queda de energia/rede/disco;
- autorização formal para restaurante fechado.
