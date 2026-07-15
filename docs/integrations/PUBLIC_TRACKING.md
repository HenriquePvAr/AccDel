# Tracking publico tokenizado

Quando o pedido WhatsApp sai para entrega, o processor gera 32 bytes aleatorios em base64url. Somente SHA-256 e salvo em `PublicTrackingToken`; o valor bruto existe apenas para montar o link enviado ao cliente.

`GET /tracking/:token` e publico, limitado por IP e nao aceita loja por header. A resposta contem somente numero/status do pedido, mensagem, ETA aproximado, timestamp e ultima coordenada arredondada para tres casas decimais (aproximadamente 100 m).

Nao sao expostos telefone, customer/driver/store IDs, nome do motoboy, historico, rota completa ou outras paradas. Tokens expiram por `PUBLIC_TRACKING_TTL_MINUTES` e sao revogados quando o pedido conclui ou cancela.

Tokens invalidos, expirados ou revogados retornam 404 para reduzir enumeracao. HTTPS e obrigatorio no ambiente publico.
