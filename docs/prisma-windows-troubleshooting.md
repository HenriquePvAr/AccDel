# Prisma no Windows

Este projeto usa Prisma no backend NestJS em `apps/api`.

## Comandos seguros

Use estes comandos na raiz do projeto:

```bash
npm run api:prisma:generate
npm run api:prisma:status
npm run api:prisma:migrate
```

No Cain Delivery, `api:prisma:migrate` aplica migrations existentes com
`prisma migrate deploy`. Esse e o caminho seguro para validar banco local ou
producao sem abrir o fluxo interativo do Prisma.

## Quando usar migrate dev

Use `migrate dev` apenas quando voce alterou `apps/api/prisma/schema.prisma` e
quer criar uma nova migration:

```bash
npm run api:prisma:migrate:dev
```

Antes de rodar esse comando no Windows, pare processos que usam Prisma Client:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'api:dev|src/main\.ts|prisma.*migrate' } |
  Select-Object ProcessId, CommandLine
```

Depois encerre apenas os processos realmente presos de API/migration:

```powershell
Stop-Process -Id <PID> -Force
```

## DLL lock do Prisma Client

No Windows, `prisma generate` pode falhar com erro parecido com:

```text
EPERM: operation not permitted, rename query_engine-windows.dll.node.tmp -> query_engine-windows.dll.node
```

Isso normalmente acontece porque a API NestJS esta rodando e segurando o arquivo
`apps/api/node_modules/.prisma/client/query_engine-windows.dll.node`.

Solucao:

1. Pare `npm run api:dev`.
2. Rode `npm run api:prisma:generate`.
3. Suba a API novamente com `npm run api:dev`.

## Advisory lock do PostgreSQL

`prisma migrate dev` pode travar ou falhar com:

```text
Timed out trying to acquire a postgres advisory lock
```

Isso indica outro processo de migration segurando o lock. Verifique processos
Node com:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'prisma.*migrate|api:prisma:migrate' } |
  Select-Object ProcessId, CommandLine
```

Se confirmar que sao processos antigos presos, encerre-os:

```powershell
Stop-Process -Id <PID> -Force
```

Depois confirme o estado real do banco:

```bash
npm run api:prisma:status
npm run api:prisma:migrate
```

## Regra pratica

- Para aplicar migrations ja criadas: `npm run api:prisma:migrate`.
- Para verificar estado do banco: `npm run api:prisma:status`.
- Para recriar Prisma Client: pare a API e rode `npm run api:prisma:generate`.
- Para criar migration nova: pare a API e rode `npm run api:prisma:migrate:dev`.

Nao ignore erro de migration. Se `status` disser que o banco nao esta em dia,
corrija antes de rodar a aplicacao.
