# Notificacoes de pedido

Pedidos com `source=whatsapp` e `serviceType=delivery|pickup` geram eventos idempotentes:

- confirmado na mesma escrita da criacao;
- em preparo, saiu para entrega, entregue e cancelado na mesma transacao da mudanca de estado;
- transicao `ready` nao envia notificacao nesta versao.

O processor faz claim recuperavel. Dentro da janela de 24 horas envia texto livre; fora dela exige o template utility aprovado correspondente. O idioma padrao e `pt_BR`.

Os templates esperam o numero do pedido como primeiro parametro. O template de saida para entrega espera tambem a URL de tracking como segundo parametro. Os nomes sao configurados em `WHATSAPP_TEMPLATE_ORDER_*`; confira a quantidade/ordem dos parametros aprovados no Meta Business antes do deploy.

Transicoes de pedido nao chamam a IA. A mensagem e deterministica e passa diretamente pela outbox.
