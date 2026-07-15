# Troubleshooting do CI

## Triagem inicial

Classifique antes de alterar qualquer arquivo:

1. **Falha de código:** o mesmo comando falha localmente com o lockfile atual.
2. **Falha de workflow:** caminho, variável fictícia, permissão ou ordem do job está incorreta.
3. **Limitação do runner:** imagem, browser, container ou recurso do runner não suporta o comando estável local.
4. **Indisponibilidade externa:** download do npm, action oficial, browser ou imagem do PostgreSQL indisponível.

Não atualize dependências, não desative checks e não transforme falha em warning para obter um resultado verde.

## Instalação npm

- confirme Node `24.16.0` no log;
- confirme que o `cache-dependency-path` aponta para o lockfile do job;
- execute `npm ci` localmente no mesmo diretório;
- se o lockfile divergir do manifest, corrija a causa em uma mudança separada e explicitamente autorizada;
- nunca substitua por `npm install` no CI.

## Prisma e API unitária

`prisma.config.ts` exige `DIRECT_URL`. O workflow fornece uma URL fictícia bem formada; o job unitário não inicia banco. Se generate/validate falhar, confirme o working directory `apps/api` e use `npx --no-install` para impedir download de CLI diferente.

Providers devem permanecer `disabled`. Não adicione credenciais Meta/NVIDIA para corrigir testes.

## PostgreSQL

- confira o health check do service container;
- o banco deve se chamar `accdel_security_test` e permanecer em loopback;
- confirme `DATABASE_URL` e `DIRECT_URL` iguais dentro do job;
- migrations temporárias só podem criar/remover nomes aceitos pelas guardas dos scripts;
- em falha da matriz, preserve o log, identifique o cenário de origem e não use `migrate reset`;
- em falha de integração, execute somente contra um banco local descartável.

A matriz incremental não deve receber arquivos `.env.staging`/`.pilot` fabricados no CI apenas para contornar a detecção de Docker. Antes de promovê-la a check obrigatório, o script precisará suportar explicitamente o service container sem alterar a segurança do modo Compose.

Os fluxos completos e backup/restore não devem ser adicionados apressadamente ao CI: primeiro é necessário encapsular API, Print Agent, seed e credenciais fictícias como processos controlados, com cleanup garantido.

## Waiter e Playwright

- o projeto usa `channel: 'chrome'`, portanto o job instala somente Chrome;
- confirme que o build gerou `dist` antes do Playwright;
- o webServer esperado é `http://127.0.0.1:4174`;
- o build requer `@types/node` do lockfile raiz; preserve o `npm ci` de tooling antes do install do app;
- não inicie `preview` manualmente em background no workflow;
- baixe o artefato de falha e verifique primeiro `trace.zip`, depois screenshot e relatório;
- não versione screenshots ou relatórios gerados.

Se a instalação do browser estiver temporariamente indisponível, classifique como indisponibilidade externa e reexecute o job. Não remova os 19 testes.

## Print Agent

A suíte válida não precisa de impressora física. O TCP mock usa loopback e o dry-run usa diretório temporário. Qualquer tentativa de acessar spooler, IP externo ou impressora real é erro de workflow. `WINDOWS_SPOOLER_NOT_IMPLEMENTED` é uma proteção esperada, não motivo para habilitar impressão real no runner Linux.

## Driver App

O lint carrega `eslint.config.js` da raiz, portanto o job instala o lockfile raiz antes do lockfile do app. O export usa `EXPO_OFFLINE=1` e não pode chamar EAS. Se lint/typecheck passarem e o export falhar apenas por incompatibilidade comprovada do runner, registre a limitação com o log completo antes de propor que o export volte a ser gate de laboratório. Não publique, não gere APK/AAB e não execute correções automáticas do Expo.

## Artefatos, secrets e permissões

- `permissions` deve continuar `contents: read`;
- não use `pull_request_target`;
- não coloque título/corpo do PR em `run`;
- não adicione PAT ou secrets reais;
- mantenha upload somente em falha, com caminhos explícitos e retenção curta;
- qualquer nova action deve vir de fonte reconhecida e ficar presa a SHA completo.

## Como adicionar um check

1. confirme que o comando existe no `package.json` ou corresponde a um binário já presente no lockfile;
2. execute localmente sem alterar arquivos rastreados;
3. defina working directory, timeout e permissões mínimas;
4. evite rede externa, secrets e processos persistentes;
5. valide YAML e actionlint;
6. atualize `CI_MATRIX.md` e este runbook;
7. faça staging explícito e revise o diff completo.

## Handoff para homologação física

Com todos os checks verdes, prossiga para `docs/pilot/HARDWARE_CHECKLIST.md`, `docs/pilot/STAGING_RUNBOOK.md` e `docs/pilot/BACKUP_AND_RESTORE.md`. A homologação deve usar ambiente isolado, dados fictícios, backup verificado e responsáveis definidos. CI verde não autoriza produção nem restaurante fechado.
