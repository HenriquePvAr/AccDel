# Templates ESC/POS

## Versionamento

Cada job persiste `templateKey`, `templateVersion`, snapshot imutável e hash. A versão atual é `v1`. Alterações incompatíveis devem criar nova versão; nunca edite o significado histórico de `v1`.

| Template | Uso atual | Dados permitidos |
| --- | --- | --- |
| `kitchen-order` | pedido inicial, adição, cancelamento e reimpressão de produção | itens, adicionais e observações |
| `bar-order` | produção do bar | itens, adicionais e observações |
| `cashier-receipt` | pagamento confirmado | itens e valores financeiros necessários |
| `customer-receipt` | via do cliente quando a política solicitar | itens e valores financeiros necessários |
| `dispatch-order` | expedição | nome operacional, telefone mascarado, endereço, cobrança e entregador |
| `test-page` | teste administrativo | configuração técnica, sem pedido |

O tipo do evento aparece no cabeçalho. Reimpressões exibem `*** REIMPRESSAO ***` e têm um job novo vinculado ao original.

## Layout

- 58 mm: 32 colunas base.
- 80 mm: 48 colunas base.
- Quantidades, adicionais e observações quebram linha deterministicamente.
- Valores são formatados em reais e alinhados em colunas.
- Cada via termina com um identificador curto do job.
- O renderer limita texto à codificação suportada antes de gerar bytes.

O payload tem limite de 1 MiB no driver TCP. Templates desconhecidos, versões desconhecidas e snapshots inválidos falham definitivamente sem enviar bytes.

## Acentos e símbolos

`CP860` e `CP850` usam o mapa explícito compartilhado pelo renderer para os caracteres PT-BR cobertos. `ASCII` translitera diacríticos. Pontuação tipográfica é normalizada e caracteres não representáveis viram `?`.

Esse comportamento foi validado em bytes e dry-run, não em firmware físico. Uma página de teste real é obrigatória porque modelos ESC/POS divergem na tabela ativa.

## Exemplos sanitizados

Os arquivos em `docs/printing/examples` são gerados pelo mesmo código usado pelo agente e usam somente dados fictícios:

```powershell
npm.cmd --prefix apps/print-agent run examples
```

Arquivos disponíveis:

- `kitchen-58mm.txt` e `kitchen-80mm.txt`;
- `bar-58mm.txt`;
- `cashier-80mm.txt`;
- `dispatch-80mm.txt`;
- `addition-58mm.txt`;
- `cancellation-58mm.txt`;
- `reprint-58mm.txt`.

Regenerar os exemplos faz parte da revisão de qualquer mudança de template.
