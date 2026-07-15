# Outbox de mensageria

## Fluxo e garantias

```text
evento interno -> outbox na transação -> commit -> claim do worker -> provider -> resultado persistido
```

Nenhuma chamada externa ocorre dentro da transação do pedido. `OutboundMessage` é gravada antes do envio e a chave única `(store_id, idempotency_key)` impede duplicata interna. Reutilizar a mesma chave com conteúdo divergente é conflito, não sucesso silencioso.

O claim usa uma única CTE PostgreSQL com `FOR UPDATE SKIP LOCKED`. Duas instâncias não obtêm a mesma linha. Uma mensagem posterior da mesma conversa permanece bloqueada enquanto existir anterior em `PENDING` ou `SENDING`; o desempate é `created_at, id`.

Conta, conversa e pedido são revalidados contra a loja antes de enfileirar. O provider selecionado é explícito e não há fallback Cloud/Evolution.

## Estados e recuperação

`PENDING -> SENDING -> SENT -> DELIVERED -> READ` ou `FAILED`.

Falhas 408, 409, 425, 429, 5xx, timeout e rede voltam a `PENDING` com backoff exponencial e jitter. Falhas permanentes ou esgotamento terminam em `FAILED`. Locks `SENDING` com mais de cinco minutos podem ser reclamados após encerramento inesperado.

Status da Meta é monotônico por compare-and-set. Evento que chega antes do ID externo fica no recibo inbound e é reconciliado assim que o worker persiste o ID.

## Sandbox e handoff

Todas as origens — IA, humano e notificações — passam pelo sandbox no worker. Destinatário não permitido falha antes do provider, sem telefone completo no log.

Mensagem de IA pendente é cancelada quando a conversa entra em `WAITING_HUMAN` ou `HUMAN_ACTIVE`. O worker também recusa uma mensagem de IA já claimed se o estado mudou antes do envio. Uma chamada externa já iniciada não pode ser recolhida; esse é um risco residual monitorável.

## Privacidade e limite de idempotência

Eventos e outbox recebem `retentionUntil` de 30 dias e job diário remove expirados. Tokens e headers nunca entram no payload persistido.

A idempotência interna é forte. Existe, porém, uma janela de incerteza se a Meta aceitar a mensagem e o processo morrer antes de salvar o ID externo, pois a Graph API não recebe nossa chave interna.
