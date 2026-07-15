# Configuração de impressora no Windows

## Caminho suportado agora: rede RAW/TCP

O agente pode falar diretamente com impressoras ESC/POS acessíveis por TCP. O teste automatizado usou apenas um servidor loopback simulado; uma impressora real ainda precisa de homologação.

1. Reserve um IP para a impressora no DHCP ou configure IP estático segundo o fabricante.
2. Confirme a porta RAW do modelo. `9100` é comum, mas não deve ser presumida.
3. No Firewall do Windows, permita somente a saída do host do agente para o IP e a porta necessários.
4. No painel, crie a impressora com conexão `NETWORK_TCP`, endereço IP ou hostname interno e porta validada.
5. Selecione largura de 58 ou 80 mm e encoding coerente com a configuração física.
6. Vincule a impressora a um agente ativo e à estação correta.
7. Faça primeiro o teste com o agente em dry-run; depois siga o checklist de impressora real.

Teste de conectividade sem imprimir:

```powershell
Test-NetConnection -ComputerName 192.0.2.40 -Port 9100
```

`192.0.2.40` é um endereço reservado para documentação. Substitua somente no ambiente local e não versione endereços privados da operação.

## Spooler/USB instalado no Windows

O tipo `WINDOWS_PRINTER` está modelado, mas o adaptador RAW para o spooler não foi implementado nesta versão. O painel não deve tratar uma impressora desse tipo como pronta e o agente reporta `WINDOWS_SPOOLER_NOT_IMPLEMENTED`.

Não contorne isso com scripts PowerShell, diálogo do navegador ou impressão gráfica: esses caminhos alteram as garantias de payload, auditoria e resultado ambíguo. A implementação futura deve usar um adaptador RAW controlado, limites de payload e os mesmos estados do ledger.

## Papel, corte e code page

- 58 mm usa 32 colunas base; 80 mm usa 48.
- O renderer produz comandos ESC/POS de inicialização, alinhamento, negrito, tamanho e corte total.
- CP860/CP850 usam um subconjunto explícito de caracteres portugueses; ASCII remove diacríticos.
- A seleção configurada não negocia automaticamente a tabela de caracteres da impressora.
- Emoji e caracteres não suportados viram `?` de forma determinística.

Valide `ação`, `café`, `pão`, `açúcar`, `coração`, `maçã` e `limão` na página de teste. Divergência indica code page física incompatível e bloqueia o piloto.

## Segurança da rede

- mantenha impressora e agente em VLAN/rede interna;
- não exponha a porta RAW à internet;
- use conta dedicada e sem administrador para o agente;
- não registre IP, token ou conteúdo integral de pedidos em tickets públicos;
- desligue a impressão física imediatamente se houver saída duplicada ou PII na estação errada.
