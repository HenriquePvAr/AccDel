# Segurança do Cain Garçom

## Controles no servidor

- JWT obrigatório e tenant derivado do contexto autenticado.
- Guard revalida usuário, membership e perfil ativos a cada request operacional.
- RBAC mínimo para garçom; gerente possui bypass de ownership, não de tenant.
- Garçom acessa apenas a sessão atribuída a ele.
- Todas as consultas e mutações são filtradas por `storeId`.
- Preço, disponibilidade, total e transições são recalculados na API.
- Idempotência e rate limit protegem escritas repetidas.
- Versões otimistas impedem sobrescrita silenciosa entre dois dispositivos.
- Cancelamento persiste ator, motivo e instante; fechamento não cria pagamento.
- Stream SSE é autenticado e filtrado por loja/eventos.

## Controles no dispositivo

- Senha nunca é armazenada.
- Token não é persistido além da sessão do navegador.
- CSP de produção restringe origens; service worker não armazena API autenticada.
- Logout limpa dados do usuário; telemetria permanece local e sem PII.
- Estados pendente, falho e desconhecido são distintos de sucesso.

## Limites conhecidos

Revogação imediata de JWT entre requests não foi adicionada; o guard reduz o risco rechecando o banco, mas o prazo do token ainda importa. Não houve pentest externo, dispositivo compartilhado real nem avaliação MDM. TLS, cabeçalhos do proxy, rotação de segredo, backup e observabilidade externa continuam responsabilidades do ambiente.
