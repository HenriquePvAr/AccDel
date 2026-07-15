# Segurança e privacidade da impressão

## Fronteiras de confiança

- O usuário humano autentica com JWT e permissões `printing:view`, `printing:manage` e `printing:reprint`.
- O agente usa credencial própria, restrita à loja e às rotas `/print-agent`.
- A loja vem do contexto autenticado; IDs ou headers enviados pelo caller não escolhem outro tenant.
- A impressora só recebe jobs quando está habilitada, vinculada a um agente ativo e elegível para a estação.

Tokens de agente têm prefixo identificável, material aleatório e armazenamento server-side somente como SHA-256. Provisionamento e rotação mostram o token uma única vez. Revogação invalida o acesso imediatamente.

## Minimização por destino

| Destino | Incluído | Excluído |
| --- | --- | --- |
| Cozinha/bar | número, serviço, itens, adicionais, notas | telefone, endereço, pagamento e valores |
| Caixa/cliente | itens e valores necessários | token, credenciais e dados técnicos do agente |
| Expedição | nome operacional, telefone mascarado, endereço e cobrança | telefone integral e dados desnecessários de pagamento |
| Teste | configuração técnica fictícia | dados de pedido |

O snapshot integral não é escrito nos logs gerais. Logs usam IDs opacos, códigos de erro, duração, quantidade de bytes e hashes.

## Dados no host do agente

Dry-run contém o texto que seria impresso e, portanto, pode conter dados operacionais. Use diretório restrito, retenção mínima e disco protegido por ACL/BitLocker conforme a política local. A aplicação usa modo `0600/0700` quando o sistema respeita permissões POSIX, mas isso não substitui ACL do Windows.

O ledger local contém o snapshot do job enquanto necessário para recuperação. Não há criptografia de aplicação nesta versão. O piloto deve ocorrer somente em máquina controlada, com conta dedicada e acesso físico limitado.

## Rede

- prefira HTTPS entre agente e API fora do mesmo host;
- mantenha impressão RAW/TCP apenas em rede interna;
- não publique porta 9100 na internet;
- limite firewall ao host/porta da impressora;
- mantenha relógio do host sincronizado para leases e auditoria.

## Auditoria

Provisionamento, rotação, revogação, criação, claim, tentativas, falhas, cancelamento, retry e reimpressão geram registros auditáveis. Reimpressão exige motivo e cria novo job; nunca altera a evidência original.

## Resposta a incidente

1. Revogue o agente no painel.
2. Pare o processo local.
3. Preserve ledger e logs restritos para investigação; não os anexe a canais públicos.
4. Identifique jobs, estação e janela de tempo sem copiar snapshots completos.
5. Rotacione o token antes de retomar.
6. Se houve exposição de dados impressos ou dry-run, aplique o processo de privacidade da organização.

## Limites conhecidos

- O token não é protegido por hardware e o ledger não tem criptografia própria.
- Não há mTLS entre agente e API.
- Não há spooler Windows controlado.
- Não há garantia criptográfica de que uma impressora física executou o papel/corte.

Esses limites impedem classificar a solução como pronta para produção sem piloto, hardening do host e homologação física.
