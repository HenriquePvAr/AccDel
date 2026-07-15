# Testes locais de impressão

Todos os comandos abaixo evitam impressora física. Use PowerShell e `npm.cmd` no Windows.

## Validação estática e unitária

```powershell
npm.cmd run api:build
npm.cmd run api:lint
npm.cmd run api:test
npm.cmd run print-agent:typecheck
npm.cmd run print-agent:lint
npm.cmd run print-agent:test
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

Os testes do agente cobrem renderer, acentos/fallback, templates, ledger, dry-run e TCP loopback simulado.

## Exemplos de recibo

```powershell
npm.cmd --prefix apps/print-agent run examples
```

Revise `docs/printing/examples`. Os arquivos devem continuar sem telefone real, endereço real, credencial ou identificador de produção.

## PostgreSQL embutido

Em um terminal dedicado:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55433/accdel_printing_test?schema=public'
$env:DIRECT_URL=$env:DATABASE_URL
npm.cmd --prefix apps/api run db:embedded
```

Em outro terminal, usando a mesma URL:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55433/accdel_printing_test?schema=public'
$env:DIRECT_URL=$env:DATABASE_URL
npm.cmd run api:prisma:deploy
npm.cmd run api:test:integration
```

O nome de banco de integração é explicitamente limitado pelos testes. Não aponte a suíte para banco compartilhado, staging ou produção.

Ao terminar, use `Ctrl+C` no terminal do PostgreSQL e confirme que a porta não está ouvindo:

```powershell
Get-NetTCPConnection -LocalPort 55433 -State Listen -ErrorAction SilentlyContinue
```

## Casos PostgreSQL cobertos

- replay idempotente e conflito de snapshot;
- isolamento entre lojas;
- duas instâncias concorrentes disputando o mesmo job;
- confirmação duplicada concorrente;
- lease expirado antes/depois do início do envio;
- reimpressão com snapshot histórico;
- simulação de 40 pedidos, dois setores, duas impressoras e uma queda ambígua;
- carga de 500 jobs em lotes.

## Dry-run ponta a ponta

Para executar o processo completo, provisione um agente em uma loja local, mantenha `CAIN_PRINT_DRY_RUN=true`, vincule uma impressora `FILE_OR_VIRTUAL` e inicie:

```powershell
npm.cmd --prefix apps/print-agent run dev
```

Crie os eventos de pedido pela API/UI e confira:

- job no painel;
- `.txt`, `.bin` e `.json` no diretório configurado;
- hash e status `PRINTED`;
- ausência de duplicação após reinício normal.

Use apenas fixtures fictícias. Não copie token de agente para o terminal compartilhado ou histórico de comandos.

## O que não foi testado automaticamente

- papel físico, corte, code page de firmware e gaveta;
- USB/spooler Windows;
- perda real de energia durante o write de uma impressora;
- operação contínua em restaurante por várias horas/dias.
