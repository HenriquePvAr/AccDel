# Observabilidade e prontidão

## Endpoints

`GET /health` é público e propositalmente mínimo: estado, versão e timestamp. Ele não mostra banco, filas, nomes de agentes, providers, migrations ou erro interno.

`GET /ready` exige JWT e `dashboard:view`. A página administrativa `/operations/readiness` reflete:

- API e banco;
- migrations aplicadas/esperadas/falhas;
- filas de mensageria e impressão, pendentes e falhas;
- Print Agents online/offline;
- conversas aguardando humano e pedidos atrasados;
- conexões SSE/realtime;
- WhatsApp, IA, sandbox e flags;
- versão/source commit.

Estados: `ready` permite laboratório; `attention` exige decisão humana; `not_ready` bloqueia início do turno.

## Logs

Cada requisição recebe/propaga `x-correlation-id`. Eventos estruturados incluem categoria, operação, resultado, duração e IDs técnicos mínimos. Pesquisar um incidente:

```powershell
npm.cmd run staging:logs
```

Correlacione autenticação, criação/transição de pedido, conflito, pagamento, outbox, PrintJob, claim/resultado do agente, SSE e sessão de mesa. Nunca registrar ou compartilhar senha, token, segredo, telefone/endereço completo, mensagem integral, payload de pagamento ou coordenada precisa.

## Rotina do turno

Antes de abrir:

1. confirmar backup e espaço em disco;
2. abrir Prontidão e verificar 23/23 migrations, zero falhas e agente esperado online;
3. confirmar `disabled` para WhatsApp/IA e sandbox ativo;
4. executar um pedido fictício com impressão dry-run ou física somente quando autorizada;
5. registrar versão e responsável.

Durante o turno, revisar prontidão a cada 30 minutos e quando houver atraso/repetição. Não limpar fila para esconder falha. Jobs `UNKNOWN_RESULT` exigem inspeção física antes de retry.

Depois do turno, exportar somente métricas agregadas, registrar incidentes e realizar backup. Revogar agentes/dispositivos não usados.

## Alertas operacionais

- migration diferente de 23 ou falha: não iniciar;
- banco desconectado: interromper mutações;
- mensagem/PrintJob falho: investigar; não repetir ação de negócio;
- agente obrigatório offline: impressão manual ou rollback;
- pedidos atrasados/conversas humanas crescendo: reduzir escopo;
- versão diferente da aprovada: parar e reconciliar Git/artefato.

Métricas e rate limit são parcialmente locais por processo. Em múltiplas APIs, filas e claims continuam protegidos pelo PostgreSQL, mas os contadores não devem ser somados como se fossem globais.
