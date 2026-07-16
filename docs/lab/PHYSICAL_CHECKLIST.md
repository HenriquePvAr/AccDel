# Checklist fisico supervisionado

Preencher manualmente. Nenhum item marcado por software substitui a verificacao humana.

## Pessoas e ambiente

- [ ] Restaurante fechado para clientes.
- [ ] Responsavel tecnico presente.
- [ ] Responsavel operacional presente.
- [ ] Botao/plano de parada conhecido.
- [ ] Backup ficticio criado e recuperacao compreendida.
- [ ] Dados ficticios carregados; nenhum dado pessoal real.
- [ ] Meta, NVIDIA e notificacoes externas desativadas.

## Computador e rede

- [ ] Computador na rede privada de laboratorio.
- [ ] IPv4 confirmado localmente.
- [ ] Firewall revisado manualmente; somente regras necessarias e temporarias.
- [ ] Dois celulares na mesma rede, fora de isolamento de convidados.
- [ ] Carregadores/bateria disponiveis.
- [ ] Chrome/Edge dos aparelhos atualizados.
- [ ] Economia de energia desativada apenas durante o teste.
- [ ] Restricao de HTTP/service worker compreendida.

## Impressora

- [ ] Impressora termica conectada.
- [ ] Foto da etiqueta e modelo registrados.
- [ ] Papel colocado.
- [ ] Largura 58/80 mm confirmada.
- [ ] Driver correto instalado manualmente antes da sessao.
- [ ] Fila Windows ou IP/USB/serial exato confirmado.
- [ ] Linguagem ESC/POS ou alternativa confirmada no manual.
- [ ] Gaveta/corte tratados como funcoes potencialmente ativas.
- [ ] Autorizacao separada para um unico cupom ficticio recebida.

## Execucao

- [ ] `check-prerequisites.ps1` aprovado.
- [ ] Smoke dry-run aprovado antes da impressao.
- [ ] Admin acessivel apenas no computador.
- [ ] Waiter validado em cada celular.
- [ ] Dois usuarios simultaneos validados.
- [ ] Perda e retorno de rede validados.
- [ ] Evidencias registradas sem secrets, IP completo ou dados pessoais.
- [ ] `stop-lab.ps1` executado e portas liberadas.

Sem a autorizacao separada, o teste deve terminar no dry-run.
