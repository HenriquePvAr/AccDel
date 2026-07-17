# Cain Print Agent

## Papel do agente

O Cain Print Agent é um processo Node.js instalado na rede do restaurante. Ele autentica com uma credencial própria, consulta apenas as impressoras vinculadas a ele, faz claim de jobs persistidos, renderiza ESC/POS e confirma o resultado para a API.

O navegador nunca envia bytes à impressora. A API continua sendo a fonte da verdade e o agente não altera pedidos.

## Estado desta entrega

| Capacidade | Estado |
| --- | --- |
| Claim com lease e autenticação por agente | Implementado e validado em PostgreSQL |
| Renderização ESC/POS 58/80 mm | Implementado e validado por testes/dry-run |
| Saída TXT/BIN/JSON | Implementado e validado por dry-run |
| Impressora de rede RAW/TCP | Implementado e validado apenas contra servidor TCP simulado |
| Impressora instalada no Windows/spooler RAW | Não implementado |
| Impressora física | Não validado nesta entrega |

## Preparação

1. Use o painel em `/settings/printing`, aba **Agentes**, e provisione um agente para a loja.
2. Copie o token exibido uma única vez para um gerenciador de segredos local.
3. Em `apps/print-agent`, copie `.env.example` para `.env` sem versionar o arquivo.
4. Mantenha `CAIN_PRINT_DRY_RUN=true` no primeiro teste.

Configuração mínima:

```dotenv
CAIN_API_BASE_URL=http://127.0.0.1:3333
CAIN_PRINT_AGENT_TOKEN=<token provisório>
CAIN_PRINT_AGENT_NAME=Agente Loja Centro
CAIN_PRINT_DRY_RUN=true
```

Instalação e validação:

```powershell
npm.cmd install
npm.cmd --prefix apps/print-agent run typecheck
npm.cmd --prefix apps/print-agent test
npm.cmd --prefix apps/print-agent run dev
```

O processo falha cedo se URL, token, limites ou diretórios forem inválidos. O token nunca deve ser colocado em argumento de linha de comando, log, screenshot ou serviço versionado.

## Diretórios locais

- `CAIN_PRINT_DATA_DIR`: contém `print-ledger.json`, gravado atomicamente e com permissão restritiva quando suportada pelo sistema.
- `CAIN_PRINT_OUTPUT_DIR`: recebe `.txt`, `.bin` e `.json` em dry-run.
- `CAIN_PRINT_DRY_RUN_RETENTION_HOURS`: retenção dos artefatos, 24 horas por padrão.

O ledger confirmado é limpo após 24 horas. Registros ambíguos não são descartados automaticamente.

## Execução supervisionada

Esta entrega não instala um serviço Windows. Para piloto, execute o agente em uma conta Windows dedicada, sem privilégios administrativos, sob um supervisor aprovado pela equipe de infraestrutura. Configure reinício automático, diretório de trabalho `apps/print-agent` e variáveis no cofre/ambiente do serviço.

Antes de habilitar impressão física:

- concluir o checklist de `REAL_PRINTER_VALIDATION.md`;
- fixar IP/porta da impressora;
- restringir a saída de rede do host;
- validar papel, code page e corte;
- confirmar que a estação e a impressora aparecem online no painel.

Não use `CAIN_PRINT_DRY_RUN=false` com `WINDOWS_PRINTER`: esse driver retorna `WINDOWS_SPOOLER_NOT_IMPLEMENTED` deliberadamente.

## Rotação e revogação

Rotacionar um agente invalida imediatamente o token anterior. Atualize o segredo local e reinicie o processo. Revogar o agente bloqueia configuração, heartbeat, claim e confirmação; jobs não concluídos serão recuperados pela política de lease.

## Encerramento

`Ctrl+C` ou um sinal de término solicita parada do loop. Não exclua o ledger para “destravar” um job: investigue o job no painel e siga o runbook operacional.
