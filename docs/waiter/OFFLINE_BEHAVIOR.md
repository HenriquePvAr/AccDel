# Comportamento offline

## Garantias

O Cain Garçom é offline-safe, não offline-first para operações definitivas. A última visão já carregada e o rascunho local continuam disponíveis, mas nenhuma ação é confirmada sem resposta da API.

| Situação | Comportamento |
|---|---|
| Sem conexão ao entrar | login bloqueado com mensagem clara |
| Queda com tela carregada | cache recente permanece visível e marcado como offline |
| Editar rascunho | permitido; salvo por loja, usuário e mesa por até 8 horas |
| Abrir/enviar/cancelar/entregar | bloqueado antes da requisição |
| Transferir/solicitar fechamento | bloqueado antes da requisição |
| Reconexão | refetch de sessão, mesas e catálogo; rascunho preservado |
| Conflito após reconexão | dados atuais são exibidos; usuário revisa antes de reenviar |

## Cache PWA

O service worker guarda somente shell e arquivos estáticos de mesma origem. Requisições de API, SSE e qualquer request com `Authorization` não entram no cache. Atualizações do app são ativadas de forma controlada após aviso.

## Dados locais

O token usa `sessionStorage`; rascunhos usam armazenamento local com chave composta. Logout remove token, cache em memória e rascunhos do usuário. Não há fila silenciosa de comandos: isso evita duplicidade, preço antigo e falsa confirmação.
