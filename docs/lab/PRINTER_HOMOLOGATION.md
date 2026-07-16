# Homologacao de impressora termica

## Resultado do inventario

Classificacao atual: **NENHUMA IMPRESSORA TERMICA DETECTADA**.

Foram encontradas somente filas virtuais Microsoft e Fax. Nao ha fila, driver de fabricante, USB de impressao, host TCP ou modelo termico detectavel. COM1 existe como porta serial generica, sem associacao comprovada a impressora.

## Dados manuais necessarios

Antes de qualquer teste fisico, fornecer:

- foto legivel da etiqueta traseira ou inferior;
- marca e modelo exatos;
- conexao: USB, Ethernet/Wi-Fi, compartilhamento Windows ou serial;
- largura do papel: 58 mm ou 80 mm;
- nome exibido no Windows, se houver;
- para rede, IP confirmado localmente sem publica-lo em PR;
- manual tecnico indicando linguagem, preferencialmente ESC/POS, quando disponivel.

## Print Agent auditado

| Area | Estado |
|---|---|
| `FILE_OR_VIRTUAL` | suportado; vira dry-run |
| Dry-run | grava TXT, BIN e JSON por job, com escrita atomica e retencao |
| `NETWORK_TCP` | implementado com timeout, limite de 1 MiB e estado de resultado incerto apos inicio de escrita |
| `WINDOWS_PRINTER` | bloqueado |
| Spooler Windows RAW | `WINDOWS_SPOOLER_NOT_IMPLEMENTED` |
| ESC/POS | renderer para 58/80 mm, CP860/CP850/ASCII, corte configurado pelo documento |
| Ledger | persistente, atomico, transicoes fechadas e recuperacao apos restart |
| Idempotencia | lease/attempt no backend e recusa de sobrescrever estados finais no ledger |
| API | token Bearer validado; timeout e erros sanitizados |
| Logs | token, segredo, senha, payload, endereco e telefone redigidos |

O suporte provavel a ESC/POS da futura impressora so pode ser classificado depois do modelo/manual. Nenhum byte ESC/POS real foi enviado.

## Bloqueios e aprovacao

A impressao fisica continua bloqueada. Uma autorizacao futura deve indicar impressora/fila/porta exatas, um unico cupom ficticio, largura de papel confirmada e responsavel ao lado do equipamento. Pagina de teste, gaveta e corte nao foram acionados nesta etapa.
