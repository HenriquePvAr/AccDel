# Tracking publico tokenizado

Quando o pedido WhatsApp sai para entrega, o processor confirma que o pedido pertence à loja e gera 32 bytes aleatorios em base64url. Somente SHA-256 e salvo em `PublicTrackingToken`; o valor bruto existe apenas para montar o link enviado ao cliente. Emitir novo token revoga os anteriores ativos do mesmo pedido.

`GET /tracking/:token` e publico, limitado por IP e nao aceita loja por header. A resposta contem somente numero/status do pedido, mensagem, ETA aproximado, timestamp e ultima coordenada arredondada para tres casas decimais (aproximadamente 100 m).

Nao sao expostos telefone, customer/driver/store IDs, nome do motoboy, historico, rota completa ou outras paradas. Tokens expiram por `PUBLIC_TRACKING_TTL_MINUTES` e sao revogados quando o pedido conclui ou cancela.

Tokens invalidos, expirados ou revogados retornam 404 para reduzir enumeracao. HTTPS e obrigatorio no ambiente publico.

A origem do link vem de `PUBLIC_API_URL`; na ausência, usa a origem de `WHATSAPP_WEBHOOK_PUBLIC_URL` e, apenas localmente, `http://localhost:3333`. O admin não possui rota `/tracking/:token`, portanto sua origem nunca deve ser usada para esse link.
