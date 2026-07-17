# Fluxos de uso do Cain Garçom

## Entrar e escolher mesa

1. Informar e-mail e senha.
2. A API aceita somente papel `waiter` ou `manager` ativo na loja.
3. Filtrar mesas por área, número ou situação.
4. Abrir uma mesa livre informando o número de pessoas.

Uma mesa ocupada abre diretamente a comanda. O garçom não escolhe loja nem altera o vínculo da sessão.

## Lançar pedido

1. Tocar em **Adicionar itens**.
2. Pesquisar ou escolher uma categoria.
3. Selecionar produto disponível.
4. Preencher modificadores obrigatórios, quantidade e observação.
5. Revisar o rascunho.
6. Tocar em **Enviar para cozinha**.

O caminho feliz de produto simples usa quatro ações a partir da mesa ocupada; um produto com opções acrescenta apenas as escolhas necessárias. O preço exibido é informativo e a API sempre recalcula o valor vigente.

## Após o envio

- Um novo item fica separado de itens já enviados.
- Itens mostram produção, impressão, pronto, entregue, cancelado ou resultado desconhecido.
- Cancelar item enviado exige motivo e confirmação.
- Item pronto oferece **Marcar como entregue**.
- Falha ou pendência de impressão nunca é apresentada como sucesso.

## Transferir e fechar

- **Transferir mesa** lista somente mesas livres da mesma loja e usa as versões atuais.
- **Solicitar fechamento** muda a sessão para fechamento solicitado.
- Pagamento, baixa financeira e liberação da mesa continuam no caixa/admin.

## Exceções

- Produto indisponível: permanece no rascunho para correção, sem pedido falso.
- Conflito de versão: dados são atualizados e o rascunho é preservado.
- Offline: consultas recentes e rascunho ficam visíveis; abrir, enviar, cancelar, entregar, transferir e fechar são bloqueados.
- Sessão de outro garçom: a API responde com acesso negado; gerente é a exceção explícita.
