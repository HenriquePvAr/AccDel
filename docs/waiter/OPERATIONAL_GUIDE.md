# Guia operacional

## Antes do turno

1. Confirmar API, banco, KDS e Cain Print Agent saudáveis.
2. Verificar áreas, mesas, produtos, preços, disponibilidade e regras de impressão.
3. Entrar com um garçom de teste e enviar um pedido controlado.
4. Conferir o destino físico da impressão antes de liberar o salão.

## Durante o turno

- Tratar a mensagem do app como fonte do que foi aceito, nunca apenas o toque do operador.
- Se a impressão estiver pendente, falha ou desconhecida, consultar a fila; não reenviar o pedido para “forçar” papel.
- Em conflito, reler a comanda e revisar o rascunho preservado.
- Em offline, aguardar reconexão; o app não mantém fila oculta de pedidos.
- Cancelamento exige motivo. Item pronto deve ser marcado entregue somente após entrega real.
- Solicitação de fechamento é um aviso ao caixa, não confirmação de pagamento.

## Incidentes

- Sessão indevida: sair do dispositivo, desativar usuário/membership na administração e revisar logs.
- Produto/preço divergente: corrigir catálogo; a API rejeita indisponibilidade e recalcula valores.
- Impressão desconhecida: seguir `docs/printing/OPERATIONAL_RUNBOOK.md`; decisão humana evita duplicidade.
- SSE indisponível: o polling mantém atualização eventual; investigar rede/API se o aviso persistir.
- Conflitos frequentes: conferir dispositivos duplicados e atribuição do garçom.

## Fim do turno

Sair da conta em dispositivos compartilhados, conferir sessões abertas/fechamento solicitado e revisar falhas ou resultados desconhecidos de impressão. Não limpar armazenamento para esconder incidentes; preserve evidências sanitizadas.
