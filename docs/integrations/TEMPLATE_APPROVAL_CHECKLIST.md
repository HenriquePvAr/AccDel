# Checklist de aprovação dos templates Meta

Categoria esperada: `UTILITY`. Idioma esperado: `pt_BR`. Os nomes abaixo são nomes propostos; somente o Meta Business confirma nome, categoria e aprovação.

| Template | Corpo proposto | Parâmetros | Disparo |
| --- | --- | --- | --- |
| `order_confirmed` | `Pedido {{1}} confirmado e recebido pela loja.` | `{{1}}` número | Pedido WhatsApp confirmado |
| `order_preparing` | `Pedido {{1}} entrou em preparo.` | `{{1}}` número | Início do preparo |
| `order_out_for_delivery` | `Pedido {{1}} saiu para entrega. Acompanhe: {{2}}` | `{{1}}` número; `{{2}}` tracking | Saída para entrega |
| `order_delivered` | `Pedido {{1}} foi entregue. Obrigado!` | `{{1}}` número | Entrega concluída |
| `order_cancelled` | `Pedido {{1}} foi cancelado. Fale com a equipe se precisar de ajuda.` | `{{1}}` número | Cancelamento |

Exemplos de revisão: pedido `T-1001` e URL `https://api.exemplo.invalid/tracking/TOKEN_FICTICIO`. Não use dados reais nos exemplos submetidos.

Dentro da janela de 24 horas, o sistema usa texto determinístico equivalente e não precisa do template. Fora da janela, usa somente o nome configurado em `WHATSAPP_TEMPLATE_ORDER_*` e `WHATSAPP_TEMPLATE_LANGUAGE=pt_BR`.

Se o template estiver ausente, rejeitado, pausado ou com parâmetros divergentes, a notificação falha fechado como `approved_template_not_configured`; não há fallback para texto livre fora da janela.

## Checklist por template

- [ ] nome final confirmado no Meta Business;
- [ ] categoria `UTILITY` confirmada;
- [ ] idioma `pt_BR` aprovado;
- [ ] corpo final coincide com a ordem dos parâmetros;
- [ ] exemplos não contêm PII;
- [ ] qualidade e status não estão pausados;
- [ ] variável `WHATSAPP_TEMPLATE_ORDER_*` configurada no ambiente;
- [ ] envio feito somente a destinatário sandbox autorizado;
- [ ] ID externo e status registrados de forma mascarada;
- [ ] rollback documentado.

Estado em 14/07/2026: aprovação **não verificada** para os cinco templates.
