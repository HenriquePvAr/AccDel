# Ciclo de vida dos trabalhos de impressão

## Estados

```text
PENDING ──claim──> CLAIMED ──started──> PRINTING ──success──> PRINTED
   ^                   │                    │
   │                   │ lease expirado     ├─ falha temporária -> RETRY_WAIT
   │                   │ antes do envio     ├─ falha definitiva -> FAILED
   │                   └────────────────────┘
   │
RETRY_WAIT ──availableAt──> PENDING

CLAIMED/PRINTING ──evidência local ambígua──> PRINT_RESULT_UNKNOWN
PENDING/RETRY_WAIT/FAILED ──ação autorizada──> CANCELLED
```

`PRINTED`, `CANCELLED` e `PRINT_RESULT_UNKNOWN` não voltam automaticamente à
fila. Uma reimpressão cria outro job, vinculado ao original, com snapshot
histórico e marca visível `REIMPRESSÃO`.

## Idempotência

A chave lógica contém loja, evento persistido, estação, tipo e versão do
template. Há uma restrição única `(storeId, idempotencyKey)`. Repetir a mesma
requisição ou evento retorna o job existente; reutilizar a chave com outro hash
de snapshot é tratado como conflito.

Retries criam novas tentativas no mesmo job. A confirmação usa job, agente,
lease e estado atual; confirmação repetida do mesmo sucesso é idempotente.

## Claim e lease

O claim executa uma única transação PostgreSQL:

1. recupera leases vencidos que são seguros para retry;
2. seleciona jobs disponíveis com `FOR UPDATE SKIP LOCKED`;
3. filtra loja, impressoras vinculadas e habilitadas;
4. ordena por prioridade decrescente, `availableAt` e criação;
5. incrementa a tentativa e grava agente, claim e expiração;
6. registra `PrintJobAttempt` e auditoria.

O limite solicitado pelo agente é limitado pelo servidor. O desempate por
`availableAt`/criação evita starvation entre jobs de mesma prioridade.

## Recuperação e ambiguidade

O agente persiste localmente antes de enviar bytes:

- `CLAIMED`: recebido e ainda não iniciado;
- `SENDING`: envio pode ter começado;
- `SENT_UNCONFIRMED`: driver terminou, backend ainda não confirmou;
- `CONFIRMED`: backend confirmou `PRINTED`.

Após reinício, `CLAIMED` pode continuar dentro do lease. `SENDING` e
`SENT_UNCONFIRMED` nunca são reimpressos automaticamente: o agente reporta
resultado desconhecido. Sem evidência local ambígua, um lease expirado volta a
`RETRY_WAIT` com backoff. O operador pode cancelar ou criar uma reimpressão
auditada depois de verificar a via física.
