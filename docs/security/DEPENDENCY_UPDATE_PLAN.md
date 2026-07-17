# Plano de atualização de dependências

Data: 15/07/2026

Branch: `security/dependency-hardening-rc1`

## Objetivo e estado

O hardening compatível do RC1 foi concluído: as vulnerabilidades críticas e altas dos cinco installs foram eliminadas sem upgrade major, override ou `npm audit fix --force`.

| Lote | Estado | Gate |
| --- | --- | --- |
| Admin: React Router e Vite | Concluído | audit limpo e suíte aprovada |
| API: NestJS/Fastify/fast-uri | Concluído | somente 1 baixa dev residual |
| Driver: Expo SDK 54 e transitivas críticas/altas | Concluído | 0 crítica, 0 alta |
| Waiter e Print Agent | Sem alteração | audits limpos |

## Ações residuais controladas

### 1. API / esbuild

- Monitorar releases de `tsx` que aceitem `esbuild >= 0.28.1`.
- Reavaliar semanalmente até o próximo RC e obrigatoriamente antes do laboratório.
- Quando compatível, atualizar o pacote pai e o lockfile no mesmo commit; executar Prisma, build, lint, unitários e integrações PostgreSQL.
- Não forçar `esbuild` fora da faixa declarada por `tsx`.

Critério de encerramento: `npm audit` da API em zero, sem quebra da execução TypeScript usada por testes/scripts.

### 2. Driver / Expo SDK 57

- Criar uma branch dedicada, fora do RC1, para migrar SDK 54 → SDK 57.
- Seguir o procedimento oficial do Expo: atualizar o SDK, alinhar dependências compatíveis, executar `npx expo install --fix`, `npx expo-doctor` e revisar os changelogs de cada SDK intermediário.
- Revalidar permissões/location, armazenamento, autenticação, query cache, export Android, execução em dispositivo/emulador e compatibilidade de React Native.
- Reexecutar audit e inspecionar se `postcss` e `uuid` saíram das faixas afetadas.
- Não usar overrides de `postcss` ou `uuid` dentro do SDK 54: eles contornariam contratos do Metro/config plugins e da ferramenta `xcode`.

`expo-doctor` não estava instalado localmente durante este hardening e não foi baixado automaticamente. Isso é aceitável porque nenhum upgrade de SDK foi realizado.

Critério de encerramento: SDK oficialmente consistente, `expo-doctor` sem bloqueios, export Android e smoke em dispositivo aprovados, com audit sem os onze apontamentos moderados agregados.

## Cadência e responsáveis

- Antes de cada RC: executar audit nos cinco installs e comparar a matriz com [DEPENDENCY_AUDIT_RC1.md](./DEPENDENCY_AUDIT_RC1.md).
- Até o laboratório: revisão semanal dos dois resíduos.
- Qualquer nova crítica/alta: bloquear promoção, abrir lote isolado e repetir toda a validação do install afetado.
- Moderadas novas: classificar alcance de produção, cadeia exata e correção mínima antes de aceitar temporariamente.

## Estratégia de rollback

1. Identificar o commit do install afetado.
2. Reverter o commit completo, mantendo `package.json` e `package-lock.json` juntos.
3. Executar `npm ci`, audit e suíte do install.
4. Para Driver, confirmar novamente export Android offline; para API, repetir Prisma e integrações PostgreSQL; para Admin, repetir smoke no navegador.
5. Registrar a regressão e não promover a branch até uma correção compatível.

Não usar `git reset --hard`, não editar lockfile manualmente e não combinar rollback com mudança de domínio ou banco.

## Referência oficial do Expo

O upgrade major deve seguir <https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/> e permanecer separado deste RC.
