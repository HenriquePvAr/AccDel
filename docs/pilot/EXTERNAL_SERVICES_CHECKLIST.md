# Checklist de serviços externos

Não executar testes reais nesta etapa. Segredos devem ficar em cofre/secret manager, nunca em Git, ticket, screenshot ou URL.

## Meta / WhatsApp Cloud

- [ ] Responsável de negócio e conta Business aprovados
- [ ] Aplicativo Meta e ambientes de teste/produção separados
- [ ] Número de teste documentado fora do Git
- [ ] Número definitivo, propriedade e janela de migração aprovados
- [ ] Webhook HTTPS público com certificado e allowlist/perímetro
- [ ] Verify token aleatório armazenado no cofre; nunca em query de runtime
- [ ] App secret armazenado no cofre e rotação ensaiada
- [ ] Access token com menor escopo, validade e responsável definidos
- [ ] Assinatura do webhook e deduplicação verificadas
- [ ] Templates aprovados, idioma e variáveis revisados
- [ ] Sandbox ativo e `MESSAGING_ALLOWED_RECIPIENTS` restrito
- [ ] Opt-in, opt-out, retenção, privacidade e suporte aprovados
- [ ] Limites, custo, retries, dead-letter e monitoramento definidos
- [ ] Teste inicial somente com destinatário autorizado
- [ ] Rollback: flags de WhatsApp/notificações e provider `disabled`

## NVIDIA

- [ ] Conta/projeto e responsável aprovados
- [ ] Chave armazenada no cofre, escopo/rotação definidos
- [ ] Endpoint HTTPS e região confirmados
- [ ] Modelo/versionamento fixados e avaliados
- [ ] Limite de consumo/custo e alertas configurados
- [ ] Timeout, retry limitado e circuit breaker definidos
- [ ] Sandbox/corpus fictício usado na homologação
- [ ] Prompt injection, vazamento de PII e tool permissions revisados
- [ ] Handoff humano obrigatório para baixa confiança/erro
- [ ] Logs sem prompt/mensagem integral por padrão
- [ ] Fallback com `AI_PROVIDER=disabled` e atendimento humano testado

## Gate de ativação

Antes de habilitar qualquer provider: backup, prontidão verde, responsável presente, allowlist mínima, smoke test fictício, observação de logs/filas, critério de custo, rollback ensaiado e aprovação explícita. Ativar provider e feature flag são duas decisões separadas; ambas precisam estar corretas.
