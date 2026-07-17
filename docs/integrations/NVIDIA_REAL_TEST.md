# Teste real controlado da NVIDIA

## Pré-condições

```text
AI_PROVIDER=nvidia
NVIDIA_API_KEY
NVIDIA_BASE_URL
NVIDIA_MODEL
NVIDIA_TIMEOUT_MS
NVIDIA_MAX_REQUESTS_PER_MINUTE
NVIDIA_MAX_CONCURRENT_REQUESTS
NVIDIA_MAX_OUTPUT_TOKENS
```

O limite interno recomendado é 35 RPM, abaixo do limite externo conhecido para a conta. Não imprima a chave nem o corpo completo da resposta.

## Pré-validação e chamada mínima

```powershell
npm.cmd --prefix apps/api run integrations:prevalidate
npm.cmd --prefix apps/api run integrations:test:nvidia
```

O primeiro comando não chama rede. O segundo só executa quando a configuração NVIDIA está completa e usa mensagem fictícia, sem criar pedido real.

Confirme autenticação, endpoint, modelo, timeout, estrutura, latência, erro sanitizado e uma chamada com tool calling quando suportada. O rate limiter deve contar cada tentativa HTTP, inclusive retries após 429.

## Cenário isolado com tools

Em banco descartável, crie loja, produto, cliente e conversa fictícios. Verifique:

- busca retorna somente catálogo da loja de teste;
- preço e disponibilidade vêm do backend;
- criação permanece `DRAFT`;
- confirmação explícita é obrigatória;
- total é recalculado pelo backend;
- mutação repetida na mesma execução é ignorada;
- nenhuma ação de pagamento, preço ou status operacional é exposta ao modelo.

## Contagem esperada

Saudação costuma usar uma chamada lógica. Fluxos que precisam de uma tool costumam usar duas. O teto é seis chamadas lógicas por evento e três tentativas HTTP por chamada lógica. Notificações automáticas do pedido não usam NVIDIA.

Estado em 14/07/2026: **NÃO EXECUTADO — credencial local ausente**.
