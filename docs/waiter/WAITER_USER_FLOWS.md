# Fluxos do Cain Garcom

## Principios

- uma mao, alvos de toque de pelo menos 44 px;
- acoes frequentes no primeiro nivel;
- texto e icone, nunca somente cor;
- nenhuma confirmacao falsa durante offline;
- destruicao e correcao sempre explicitas;
- preco e disponibilidade confirmados apenas pelo backend.

## 1. Login

```text
email + senha
  -> POST /auth/login
  -> validar permissoes waiter:*
  -> GET /waiter/bootstrap
  -> Mesas
```

Senha nao e persistida. O token fica apenas na sessao do navegador. `401` limpa sessao, dados privados e subscriptions; depois do novo login a rota anterior pode ser retomada quando ainda pertence a mesma loja.

## 2. Mesas

```text
Mesas
  -> filtrar por salao/status
  -> buscar codigo
  -> tocar uma mesa
```

Cada mesa mostra codigo, estado textual, tempo, pessoas, responsavel e contadores de producao/pronto. A grade recebe invalidacao por SSE e mantem retry manual.

## 3. Abrir mesa

```text
mesa livre
  -> definir pessoas
  -> Abrir mesa
  -> backend atribui o garcom autenticado
```

Meta: no maximo tres acoes. Se outro dispositivo abrir primeiro, a PWA recebe `409`, descarta a suposicao local e recarrega a mesa.

## 4. Adicionar produto

```text
comanda
  -> Adicionar item
  -> categoria/busca
  -> produto
  -> somente opcoes necessarias
  -> Adicionar
```

Produto simples: ate tres acoes depois de abrir o catalogo. Produto indisponivel fica bloqueado. Se mudar antes do envio, o backend rejeita o lote e exige revisao.

## 5. Selecao temporaria

O rascunho e local, tem validade curta e chave `loja + usuario + sessao`. Ele sobrevive a navegacao acidental, mas nao e pedido nem comanda definitiva. Logout, troca de loja/usuario, expiracao ou sessao encerrada removem o rascunho.

## 6. Enviar para producao

```text
revisar itens pendentes
  -> Enviar
  -> POST idempotente /waiter/sessions/:id/items
  -> backend revalida e cria Order
  -> politica cria PrintJob
  -> resposta atualiza versao da sessao
```

Primeiro lote gera `ORDER_INITIAL`. Lotes posteriores geram `ORDER_ADDITION`. O rascunho so e apagado apos resposta confirmada.

## 7. Correcao

- item ainda no rascunho: editar/remover localmente;
- item enviado: cancelar explicitamente com motivo e versao esperada;
- backend registra ator/evento e gera `ORDER_REMOVAL` para a estacao;
- alteracao silenciosa de quantidade/adicional/observacao enviada nao sera suportada na primeira versao.

## 8. Cozinha e entrega

O estado do `Order` ligado a linha define `Em producao` ou `Pronto`. Garcom pode marcar linha pronta como `Entregue`, o que grava horario/ator na propria linha da comanda. Nao existe estado paralelo apenas no React.

## 9. Transferir mesa

```text
comanda propria ou manager
  -> Transferir
  -> escolher destino livre
  -> confirmar
  -> backend valida loja, destino e versoes
```

A transferencia preserva sessao/pedidos e nao imprime novamente.

## 10. Solicitar fechamento

```text
Resumo
  -> Solicitar fechamento
  -> confirmar
  -> sessao awaiting_close / mesa closing
  -> caixa conclui pagamento
```

O garcom ve pendente/concluido, mas nao informa forma de pagamento nem confirma recebimento.

## 11. Conexao instavel

Offline permite consultar o ultimo snapshot e editar o rascunho. Enviar, abrir, cancelar, entregar, transferir e solicitar fechamento ficam bloqueados. Ao reconectar, menu, mesa e versao sao revalidados antes da proxima mutacao.

## Navegacao

- **Mesas**: grade operacional;
- **Pedidos**: mesas com itens em producao/prontos;
- **Comanda**: ultima sessao ativa;
- **Perfil**: usuario, conexao, versao e logout.

Mobile usa barra inferior. Tablet usa trilho lateral compacto. Voltar para Mesas e sempre uma acao visivel.
