# Auditoria de dependências do RC1

Data: 15/07/2026

Base: `release/pilot-rc1` em `d9a9b93c05a02852f85e4c9f3c156b29d4d6f075`

Branch local: `security/dependency-hardening-rc1`

Ambiente: Node.js `24.16.0`, npm `11.13.0`, lockfiles npm v3.

## Escopo e controles

A auditoria cobriu os cinco installs npm independentes do repositório:

1. Admin, na raiz;
2. API, em `apps/api`;
3. Cain Garçom, em `apps/waiter-app`;
4. Print Agent, em `apps/print-agent`;
5. Driver App, em `apps/driver-app`.

Foram preservadas as versões major, o código de domínio, as migrations e o schema Prisma. Não foram usados `npm audit fix --force`, overrides, `expo install --fix`, rebase, merge ou push. Cada install alterado teve `package.json` e `package-lock.json` atualizados juntos.

## Resultado do `npm audit`

| Install | Baixas antes/depois | Moderadas antes/depois | Altas antes/depois | Críticas antes/depois |
| --- | ---: | ---: | ---: | ---: |
| Admin | 1 / 0 | 2 / 0 | 3 / 0 | 0 / 0 |
| API | 1 / 1 | 2 / 0 | 3 / 0 | 0 / 0 |
| Cain Garçom | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Print Agent | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Driver App | 1 / 0 | 14 / 11 | 2 / 0 | 1 / 0 |
| **Total** | **3 / 1** | **18 / 11** | **8 / 0** | **1 / 0** |

Resultado de gate: **0 críticas e 0 altas**. Os resíduos aceitos estão detalhados abaixo e em [DRIVER_APP_DEPENDENCY_RISKS.md](./DRIVER_APP_DEPENDENCY_RISKS.md).

## Correções aplicadas

### Admin

- `react-router-dom`: declaração `^7.14.2` → `^7.18.1`; `react-router` e `react-router-dom` resolvidos em `7.18.1`.
- `vite`: declaração `^8.0.9` → `^8.1.4`; resolvido em `8.1.4`.
- Atualizações transitivas compatíveis de `@babel/core`, `brace-expansion` e `js-yaml`.

Isso removeu as vulnerabilidades do React Router corrigidas a partir de `7.15.1` e a exposição do Vite corrigida em `8.0.16`, sem mudar o major.

### API

- `@nestjs/common`, `@nestjs/core` e `@nestjs/platform-fastify`: declaração `^11.1.9` → `^11.1.28`; resolvidos em `11.1.28`.
- A cadeia passou a resolver `fastify@5.10.0` e `fast-uri@3.1.3`, acima das correções mínimas `5.8.5` e `3.1.1`.
- Atualizações transitivas compatíveis de `brace-expansion` e `js-yaml`.

A cadeia vulnerável era `@nestjs/platform-fastify@11.1.19 → fastify@5.8.4 → fast-uri@3.1.0`.

### Driver App

- `expo`: declaração `~54.0.33` → `~54.0.36`; resolvido em `54.0.36`, mantendo o SDK 54.
- `@expo/cli`: `54.0.24` → `54.0.26`.
- `shell-quote`: `1.8.3` → `1.10.0`.
- `undici`: `6.25.0` → `6.27.0`.
- `ws`: `6.2.3` → `6.2.5`, `7.5.10` → `7.5.12` e `8.20.0` → `8.21.1`.
- `tar`: `7.5.14` → `7.5.20`, além de patches transitivos de Babel, brace expansion e YAML.

A crítica estava em `react-native@0.81.5 → react-devtools-core@6.1.5 → shell-quote@1.8.3`. As altas de `undici` e `ws` estavam nas ferramentas do Expo/React Native. Busca no código confirmou ausência de execução de shell e de implementação WebSocket no app; o `fetch` de produção está em `src/api/client.ts` e usa a API do React Native, não o `undici` da CLI do Expo.

## Resíduos aceitos

### API: 1 baixa de desenvolvimento

`tsx@4.21.0` restringe `esbuild` à linha `~0.27`, atualmente resolvida em `0.27.7`. A correção indicada pelo advisory começa em `0.28.1`. É uma ferramenta de desenvolvimento/teste, não uma dependência carregada pelo runtime compilado da API. Não foi criado override incompatível; o item deve ser removido quando o pacote pai aceitar a linha corrigida.

### Driver App: 11 moderadas agregadas

O audit contabiliza onze nós, mas eles convergem em duas folhas dentro do SDK 54:

- `expo → @expo/metro-config@54.0.17 → postcss@8.4.49`;
- `expo → @expo/config-plugins@54.0.5 → xcode@3.0.1 → uuid@7.0.3`.

Os demais apontamentos são agregações nos pacotes Expo que dependem dessas cadeias. O único reparo automático oferecido muda para Expo SDK 57, um upgrade major que exige migração e validação próprias. Por isso, ele não foi misturado ao hardening do RC1. O risco, alcance e mitigação estão em [DRIVER_APP_DEPENDENCY_RISKS.md](./DRIVER_APP_DEPENDENCY_RISKS.md).

## Evidência de compatibilidade

- Admin: build, lint sem erros (quatro warnings conhecidos), 5/5 testes e navegação protegida em navegador real.
- API: Prisma generate/validate, build, lint, 65/65 testes unitários e seis grupos PostgreSQL.
- Cain Garçom: build, typecheck, lint, 14/14 testes e 19/19 cenários Playwright.
- Print Agent: build, typecheck, lint e 10/10 testes, incluindo dry-run e TCP loopback.
- Driver App: lint, typecheck e export Android offline.
- Migrations: matrizes 0→23, 19→23, 21→23 e 22→23.
- Fluxos integrados fictícios: restaurante, delivery, concorrência, impressão, readiness e backup/restore lógico.
- `npm ci`: reproduzido nos três installs alterados; no Driver houve recuperação controlada de um `ENOTEMPTY` do Windows causado por processo npm órfão, seguida de instalação limpa bem-sucedida.

Nenhuma chamada real foi feita à Meta, NVIDIA, impressora, banco externo ou ambiente de produção.

## Reprodutibilidade e rollback

Os cinco `package-lock.json` permanecem em `lockfileVersion: 3`. URLs resolvidas e integridades devem ser verificadas antes de promover a branch. O rollback preferido é reverter isoladamente o commit do install afetado, preservando o par `package.json`/`package-lock.json`, e repetir `npm ci` e a suíte correspondente. Não usar reset destrutivo nem restaurar somente um dos dois arquivos.

Comandos de reauditoria, executados dentro de cada install:

```powershell
npm ci
npm audit --json
npm ls --depth=0
```

## Fontes primárias

- `shell-quote`: <https://github.com/advisories/GHSA-w7jw-789q-3m8p>
- `undici`: <https://github.com/advisories/GHSA-p88m-4jfj-68fv>
- `ws`: <https://github.com/advisories/GHSA-58qx-3vcg-4xpx> e <https://github.com/advisories/GHSA-96hv-2xvq-fx4p>
- Nest/Fastify/fast-uri: <https://github.com/advisories/GHSA-6v32-fjc9-9qf6>, <https://github.com/advisories/GHSA-247c-9743-5963> e <https://github.com/advisories/GHSA-q3j6-qgpj-74h6>
- React Router: <https://github.com/advisories/GHSA-84g9-w2xq-vcv6>
- Vite: <https://github.com/advisories/GHSA-v6wh-96g9-6wx3>
- Processo oficial de upgrade do Expo SDK: <https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/>
