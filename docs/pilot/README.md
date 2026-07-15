# Cain Delivery — índice do piloto supervisionado

Este diretório descreve o release candidate `release/pilot-rc1`. Ele é destinado a laboratório e, após validação de hardware, ao restaurante fechado. Não autoriza produção, comunicação externa, impressão física, uso de dados reais, push ou merge.

## Decisão atual

- Implementado, integrado localmente, validado com testes e dados fictícios.
- Pronto para laboratório.
- Condicionalmente pronto para teste no restaurante fechado após preencher o checklist de hardware e executar backup nativo.
- Ainda não pronto para operação paralela, piloto limitado ou produção.

## Ordem de leitura

1. [RELEASE_CANDIDATE_REPORT.md](./RELEASE_CANDIDATE_REPORT.md)
2. [STAGING_RUNBOOK.md](./STAGING_RUNBOOK.md)
3. [PILOT_PLAN.md](./PILOT_PLAN.md)
4. [SUCCESS_AND_STOP_CRITERIA.md](./SUCCESS_AND_STOP_CRITERIA.md)
5. [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)
6. [HARDWARE_CHECKLIST.md](./HARDWARE_CHECKLIST.md)
7. [QUICK_START_SUPPORT.md](./QUICK_START_SUPPORT.md)
8. [DEPENDENCY_AUDIT_RC1.md](../security/DEPENDENCY_AUDIT_RC1.md)

## Evidências técnicas

- Auditoria: [CUMULATIVE_AUDIT.md](./CUMULATIVE_AUDIT.md) e [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)
- Eventos: [DOMAIN_EVENT_MATRIX.md](./DOMAIN_EVENT_MATRIX.md)
- Migrations: [MIGRATION_VALIDATION.md](./MIGRATION_VALIDATION.md)
- Testes: [TEST_EVIDENCE.md](./TEST_EVIDENCE.md)
- Backup: [BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md)
- Observabilidade: [OBSERVABILITY_RUNBOOK.md](./OBSERVABILITY_RUNBOOK.md)
- Telas: [VISUAL_EVIDENCE.md](./VISUAL_EVIDENCE.md)
- Dependências: [auditoria do RC1](../security/DEPENDENCY_AUDIT_RC1.md), [plano de atualização](../security/DEPENDENCY_UPDATE_PLAN.md) e [riscos residuais do Driver](../security/DRIVER_APP_DEPENDENCY_RISKS.md)

Todos os dados mostrados nas evidências são fictícios e marcados como `PILOT_DEMO_DATA`.

O hardening de dependências eliminou críticas e altas, mantendo 1 baixa de desenvolvimento na API e 11 moderadas documentadas no toolchain Expo SDK 54. Isso preserva o gate de laboratório, sem promover o sistema a restaurante ou produção.
