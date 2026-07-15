# Outbox de mensageria

## Garantias

`OutboundMessage` e gravada antes de qualquer chamada externa. A chave unica `(store_id, idempotency_key)` impede duplicata interna. O worker faz claim por compare-and-set, marca `SENDING`, incrementa tentativas e envia pelo provider explicitamente selecionado.

Falhas 408, 409, 425, 429, 5xx, timeout e rede voltam para `PENDING` com backoff exponencial e jitter. Falhas permanentes ou esgotamento terminam em `FAILED`. Erros sao sanitizados e limitados.

## Estados

`PENDING -> SENDING -> SENT -> DELIVERED -> READ` ou `FAILED`. Eventos da Meta podem chegar fora de ordem; ranking e timestamp evitam regressao.

Mensagens manuais e da IA usam a mesma outbox no modo Cloud. O legado continua no caminho direto somente quando `evolution_api` foi selecionado explicitamente.

## Recuperacao

Locks `SENDING` com mais de cinco minutos podem ser reclamados. Reinicio do processo nao perde mensagens pendentes. Notificacoes de pedido usam chave propria e podem reenfileirar de modo idempotente apos claim interrompido.

## Privacidade

Eventos e payloads da outbox recebem `retentionUntil` de 30 dias. Um job diario remove registros expirados. Tokens, segredos e headers de autenticacao nunca entram no payload persistido. Mensagens de conversa legadas seguem a politica geral de dados do produto e ainda exigem uma politica organizacional de exclusao/DSAR.
