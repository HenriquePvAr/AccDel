# GitHub Actions do Cain Delivery

## Escopo

Os workflows desta pasta foram criados em `ci/pilot-rc2-validation`, baseada exatamente no RC2 `20ca789120d9374155710c19eab0f40cda02df47`. Eles validam o código sem publicar, fazer deploy, acessar banco de produção, usar credenciais reais ou chamar Meta/NVIDIA.

Os cinco installs npm continuam independentes: raiz (Admin), `apps/api`, `apps/waiter-app`, `apps/print-agent` e `apps/driver-app`. Todos possuem `package-lock.json` v3. O repositório não possui `.nvmrc`, `.node-version`, `engines` ou `packageManager`; por isso o CI fixa explicitamente Node `24.16.0`, correspondente ao runtime local validado com npm `11.13.0`.

## Gatilhos e cancelamento

Cada workflow executa em:

- `pull_request` com base `main`;
- `push` somente em `release/pilot-rc2` e `ci/pilot-rc2-validation`;
- `workflow_dispatch` manual.

Não existe `pull_request_target`. Cada workflow usa um grupo de concorrência por workflow/ref e cancela apenas execuções antigas do mesmo grupo.

## Actions e runner

Os jobs usam `ubuntu-24.04`, `permissions: contents: read` e actions oficiais fixadas por SHA completo:

| Action | Release | SHA |
|---|---|---|
| `actions/checkout` | `v7.0.0` | `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` |
| `actions/setup-node` | `v7.0.0` | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/upload-artifact` | `v7.0.1` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |

O pin por SHA torna a action imutável. Atualizações devem verificar a release oficial, resolver o SHA no repositório da action e passar novamente por revisão. Referências: [uso seguro de actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [sintaxe de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) e [concorrência](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency).

## Jobs

### Admin

`ci-admin.yml` executa um único `npm ci` na raiz, seguido de `npm run build`, `npm run lint` e `npm run test`. O resultado esperado é 5/5 testes. Os quatro warnings React já documentados e o aviso informativo de chunk do Vite não alteram o exit code; erros continuam falhando o job.

### API unitária

O job `api-unit` usa somente URLs e flags fictícias, desativa providers externos e executa:

1. `npm ci`;
2. `npm run prisma:generate`;
3. `npx --no-install prisma validate`;
4. `npm run build`;
5. `npm run lint`;
6. `npm run test` (65 testes esperados).

`npx --no-install` impede download implícito de outra versão do Prisma.

### API PostgreSQL

O job `api-postgres` usa um service container oficial PostgreSQL 16, temporário e preso ao digest `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`. Usuário, senha e banco são valores fictícios do próprio workflow. O serviço fica acessível somente no runner e é descartado ao final do job.

O job executa:

1. instalação e geração do Prisma Client;
2. `prisma:migrate` no banco `accdel_security_test` vazio, cobrindo 0 → 23 migrations;
3. `test:integration`, com os seis cenários PostgreSQL de segurança, mensageria desativada, impressão e salão;
4. as simulações existentes de 40 pedidos e 500 PrintJobs, incluídas em `printing.integration.test.ts`.

O desenho segue a documentação oficial de [PostgreSQL como service container](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers). Nenhuma porta ou processo da máquina de desenvolvimento é usado.

A matriz incremental `staging:test:migrations` permanece em laboratório porque o script atual seleciona Docker Compose sempre que o host possui Docker e, nesse modo, exige os arquivos locais protegidos `.env.staging` e `.pilot/runtime.env`. O runner GitHub possui Docker, mas o CI não deve fabricar esses arquivos nem iniciar uma segunda stack. O cenário obrigatório 0 → 23 continua coberto diretamente no service container vazio.

Os fluxos completos `staging:test:flows` e `staging:backup:test` também permanecem em laboratório. Eles exigem API e Print Agent persistentes, seed piloto protegido, arquivo de credenciais gerado em runtime e banco com o marcador `PILOT_DEMO_DATA`. Executá-los parcialmente no CI criaria um falso positivo; a validação local anterior continua documentada nos relatórios do piloto.

### Waiter PWA e Playwright

`ci-waiter.yml` executa build, `tsc --noEmit` usando o binário já travado no lockfile, lint, 14 testes unitários e 19 testes Playwright. Como `playwright.config.ts` usa explicitamente `channel: 'chrome'`, o job instala somente Chrome e suas dependências, com workers e timeout já limitados pela configuração.

O `webServer` do Playwright inicia `npm run preview` em processo controlado e é encerrado pelo runner de testes. Em falha, somente relatório HTML, screenshots e `trace.zip` são enviados por sete dias. Artefatos não são enviados em sucesso. Referência: [Playwright em CI](https://playwright.dev/docs/ci).

### Print Agent

`ci-print-agent.yml` executa build, typecheck, lint e os 10 testes. A suíte cobre dry-run em diretório temporário, bytes/hash, ledger e restart, falha fechada, `WINDOWS_SPOOLER_NOT_IMPLEMENTED` e TCP mock somente em loopback. O script `examples` não é executado porque gera documentação; impressora, spooler e IP externo não são acessados.

### Driver App

`ci-driver.yml` executa lint, typecheck e `npm run build`, que corresponde a `expo export --platform android`. O job define `CI`, `EXPO_OFFLINE` e `EXPO_NO_TELEMETRY`, não usa EAS, não cria APK/AAB, não publica e remove `dist` ao final. Se o runner demonstrar incompatibilidade real, a falha deve ser documentada e investigada; lint/typecheck não podem ser mascarados.

## Cache, lockfiles e integridade

Cada job usa o cache npm apontando somente para o lockfile do aplicativo correspondente. `npm ci` continua sendo a única instalação. Browser binaries não são cacheados. Ao final, `git diff --exit-code` confirma que comandos de validação não modificaram arquivos rastreados nem lockfiles.

## Segurança

- token automático limitado a leitura de conteúdo;
- nenhuma expressão de título, corpo, branch ou mensagem de PR é interpolada em shell;
- nenhum secret é exigido pelos jobs;
- providers externos ficam desativados;
- não há `curl | shell`, PAT, deploy ou publicação;
- actions ficam presas a commits completos;
- evidência Playwright é mínima, somente em falha e com retenção curta;
- bancos e outputs são temporários e ignorados pelo Git.

## Reprodução local

Use o runtime documentado e execute cada install separadamente:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd run test

npm.cmd --prefix apps/api ci
npm.cmd --prefix apps/api run prisma:generate
npm.cmd --prefix apps/api exec -- prisma validate
npm.cmd --prefix apps/api run build
npm.cmd --prefix apps/api run lint
npm.cmd --prefix apps/api run test

npm.cmd --prefix apps/waiter-app ci
npm.cmd --prefix apps/waiter-app run build
npm.cmd --prefix apps/waiter-app exec -- tsc --noEmit
npm.cmd --prefix apps/waiter-app run lint
npm.cmd --prefix apps/waiter-app run test
npm.cmd --prefix apps/waiter-app run test:e2e

npm.cmd --prefix apps/print-agent ci
npm.cmd --prefix apps/print-agent run build
npm.cmd --prefix apps/print-agent run typecheck
npm.cmd --prefix apps/print-agent run lint
npm.cmd --prefix apps/print-agent run test

npm.cmd --prefix apps/driver-app ci
npm.cmd --prefix apps/driver-app run lint
npm.cmd --prefix apps/driver-app run typecheck
$env:CI='true'
$env:EXPO_OFFLINE='1'
$env:EXPO_NO_TELEMETRY='1'
npm.cmd --prefix apps/driver-app run build
```

Prisma generate/validate aceita uma URL PostgreSQL fictícia bem formada. Testes com `RUN_DB_INTEGRATION=1`, migrations e backup exigem um PostgreSQL local isolado com nome contendo `test`, `pilot`, `staging` ou `demo`; nunca use banco de produção.
