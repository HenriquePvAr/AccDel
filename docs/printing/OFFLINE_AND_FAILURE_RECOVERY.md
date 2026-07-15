# Operação offline e recuperação de falhas

## Princípio

Impressoras térmicas comuns não confirmam uma transação física. O sistema oferece idempotência lógica e claim exclusivo, mas não promete exactly-once físico.

O limite seguro adotado é: depois que o envio pode ter começado, o agente não repete automaticamente. A incerteza vira `PRINT_RESULT_UNKNOWN` e exige conferência humana.

## Ledger local

Antes do envio, o agente grava `print-ledger.json` atomicamente:

| Estado local | Significado | Recuperação |
| --- | --- | --- |
| `CLAIMED` | job recebido; envio não começou | pode continuar dentro do lease |
| `SENDING` | envio pode ter começado | reporta resultado desconhecido após reinício |
| `SENT_UNCONFIRMED` | driver terminou; API não confirmou | tenta entregar confirmação tardia, sem reimprimir |
| `FAILURE_UNCONFIRMED` | falha conhecida; API não recebeu | tenta entregar a falha tardia |
| `CONFIRMED` | API confirmou `PRINTED` | removido após 24 horas |
| `RESULT_UNKNOWN` | impressão física ambígua | decisão manual |
| `FAILED` | falha entregue ao backend | retry segue política do backend |

Se o ledger estiver inválido, o agente recusa impressão automática. Nunca apague ou edite o JSON durante a operação.

## API ou internet indisponível

- Jobs permanecem no PostgreSQL até um agente elegível voltar.
- Um claim local ainda não iniciado aguarda a API dentro do lease.
- Uma confirmação de sucesso ou falha fica no ledger e é reenviada.
- O heartbeat e a configuração são atualizados quando a conexão retorna.
- O agente não cria pedidos nem reconstrói snapshots localmente.

## Lease vencido

Um job apenas `CLAIMED`, sem evidência de envio, pode voltar a `RETRY_WAIT` com backoff. Um job em `PRINTING` vencido é ambíguo e não volta automaticamente à fila como se nada tivesse ocorrido.

Prioridade recebe aumento por idade no claim para reduzir starvation. O servidor usa `FOR UPDATE SKIP LOCKED`, de modo que duas instâncias não recebem o mesmo job no mesmo lease.

## Falhas temporárias e definitivas

- conexão recusada, timeout anterior ao envio ou API indisponível podem ser retryable;
- template inválido, porta inválida e driver não implementado são falhas definitivas;
- erro após início do write TCP é potencialmente impresso e vira resultado desconhecido;
- reimpressão sempre cria um job novo, com motivo e marca visível.

## Resolução de `PRINT_RESULT_UNKNOWN`

1. Verifique fisicamente a última via e o identificador curto do job.
2. Compare pedido, estação, impressora e horário no painel.
3. Se a via existe e está íntegra, não reimprima; registre a decisão operacional fora do job até existir uma ação específica de resolução.
4. Se não existe ou está ilegível, use **Reimprimir**, informe motivo objetivo e confira a marca `REIMPRESSAO`.
5. Se não for possível conferir, escale; não force retry do job original.

Uma confirmação tardia válida do mesmo agente/lease pode resolver o estado ambíguo como `PRINTED`. Confirmações de outro agente ou token são rejeitadas.
