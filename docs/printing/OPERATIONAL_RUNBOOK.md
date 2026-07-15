# Runbook operacional de impressão

## Triagem rápida

1. Abra `/settings/printing` e confira **Fila**, **Impressoras** e **Agentes**.
2. Identifique loja, job, estação, impressora, status, tentativa e último erro.
3. Não clique em reimprimir antes de conferir se uma via física já saiu.
4. Preserve o ledger do agente quando houver ambiguidade.

## Status e ação

| Status | Interpretação | Ação |
| --- | --- | --- |
| `PENDING` | aguardando agente elegível | confira agente, vínculo e disponibilidade |
| `CLAIMED` | lease obtido; envio ainda não confirmado | aguarde o lease/heartbeat; não reimprima |
| `PRINTING` | envio pode ter começado | confira fisicamente antes de qualquer ação |
| `RETRY_WAIT` | falha temporária com backoff | corrija conectividade e aguarde/retry autorizado |
| `PRINTED` | confirmação aceita | nenhuma ação; reimprima somente por necessidade operacional |
| `FAILED` | falha definitiva ou tentativas esgotadas | corrija causa e use retry/reimpressão conforme o caso |
| `PRINT_RESULT_UNKNOWN` | pode ter impresso | conferência física obrigatória |
| `CANCELLED` | retirado da fila | não volta automaticamente |

## Nenhum job aparece

- confirme que a impressão da loja está habilitada;
- valide o evento: produção, adição, pronto, pagamento ou cancelamento;
- confira regra de produto antes da categoria;
- confira fallback `DEFAULT_STATION`/`BLOCK`;
- confirme estação, impressora padrão e agente ativos;
- procure job `FAILED` de roteamento em vez de repetir o evento do pedido.

## Job parado em `PENDING`

- agente precisa estar habilitado, não revogado e com heartbeat recente;
- impressora precisa estar vinculada ao agente e ativa;
- driver local precisa reconhecer a conexão;
- em rede, teste host/porta sem enviar bytes;
- em `WINDOWS_PRINTER`, pare: o driver não está implementado.

## Falha de rede/TCP

1. Confira energia, papel e link da impressora.
2. Valide IP reservado e porta indicada pelo fabricante.
3. Execute `Test-NetConnection` do host do agente.
4. Corrija firewall/VLAN sem expor a porta à internet.
5. Se o erro ocorreu antes do write, retry pode ser seguro.
6. Se ocorreu depois do write, trate como resultado desconhecido.

## Resultado desconhecido

- localize a última via e compare o ID curto;
- se impressa e legível, não reimprima;
- se ausente/ilegível e verificado, crie reimpressão com motivo;
- se inconclusivo, escale ao responsável técnico;
- nunca altere banco, lease ou ledger manualmente.

## Reimpressão

Requer `printing:reprint`. Informe motivo específico, selecione somente impressora elegível e confira `*** REIMPRESSAO ***`. O novo job mantém vínculo com o original e usa o snapshot histórico, não o estado mutável atual do pedido.

## Agente offline

- confirme processo e relógio do Windows;
- confira acesso HTTPS à API e validade do token;
- se o token foi rotacionado, atualize o segredo e reinicie;
- se revogado, provisione/ative conforme autorização;
- não apague `print-ledger.json`;
- reinícios após `SENDING` devem gerar ambiguidade, não duplicação automática.

## Vazamento ou rota errada

1. Pare/revogue o agente imediatamente.
2. Desabilite a política de impressão da loja.
3. Preserve IDs e horários sem compartilhar snapshot.
4. Acione o processo de segurança/privacidade.
5. Só retome após corrigir regras, permissões e validar com dados fictícios.

## Observabilidade disponível

O painel fornece contagens, fila, tentativas, último erro, agentes e auditoria persistida. Logs do agente fornecem códigos e duração sem snapshot integral. Não há métricas Prometheus nem alerta externo nesta entrega; o piloto exige acompanhamento humano.

## Escalonamento

Escale quando houver: repetição física não explicada, job perdido, divergência de tenant, PII na estação errada, corrupção de ledger, falha recorrente após retry ou necessidade de usar spooler Windows.
