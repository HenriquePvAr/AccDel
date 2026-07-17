# Atendente com NVIDIA NIM

## Provider

O gateway usa a interface OpenAI-compatible `POST /v1/chat/completions` da NVIDIA. Base URL, modelo e chave sao configurados por ambiente; nenhum modelo e fixado no codigo.

Fontes oficiais:

- [NVIDIA NIM for LLMs — API reference](https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html)
- [NVIDIA API Catalog — Meta Llama](https://build.nvidia.com/meta/llama-3_1-8b-instruct)

Variaveis: `AI_PROVIDER=nvidia`, `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL`, `NVIDIA_TIMEOUT_MS`, `NVIDIA_MAX_REQUESTS_PER_MINUTE`, `NVIDIA_MAX_CONCURRENT_REQUESTS` e `NVIDIA_MAX_OUTPUT_TOKENS`. Nomes legados de RPM/concorrencia continuam aceitos temporariamente, mas os nomes `MAX_*` sao os canonicos.

## Controles de resiliencia

- `AbortController` por requisicao;
- no maximo tres tentativas para rede, 429 e HTTP transitorio;
- backoff exponencial com jitter;
- limite deslizante de requisicoes por minuto aplicado a cada tentativa HTTP, inclusive retry;
- limite de concorrencia e fila maxima;
- circuit breaker de 30 segundos apos cinco falhas consecutivas;
- logs guardam IDs/codigos/latencia, nunca prompt, conversa, chave ou resultado de ferramenta.

## Tool calling

A IA nao recebe Prisma nem IDs de tenant enviados pelo usuario. A allowlist e:

`get_store_status`, `search_menu`, `get_product_details`, `create_draft_order`, `add_item_to_draft`, `remove_item_from_draft`, `get_draft_summary`, `set_delivery_information`, `confirm_draft_order`, `get_order_status` e `request_human_handoff`.

Argumentos sao validados por Zod, tem tamanho limitado e nao aceitam campos extras. `storeId`, `customerId`, conta e conversa sao derivados do evento autenticado. O audit log armazena apenas hash dos argumentos e codigo de resultado.

O cardapio completo nunca e colocado no prompt: a IA busca termos e recebe no maximo oito resultados; detalhes sao consultados por produto. Precos, opcoes e disponibilidade sao revalidados no resumo e novamente pelo `OrdersService` ao converter o rascunho.

## Confirmacao e fallback

`confirm_draft_order` so executa se a mensagem de entrada atual corresponder a uma frase explicita reconhecida pelo backend. O texto gerado pela IA nao pode fabricar essa confirmacao. A criacao usa idempotencia persistente baseada no ID externo da mensagem.

Falha do provider, resposta vazia/grande ou excesso de ferramentas pausa a IA, move a conversa para `WAITING_HUMAN` e enfileira uma mensagem deterministica de handoff.

Uma mutacao com os mesmos argumentos canonicos nao e executada duas vezes na mesma `AiExecution`. Execucao interrompida que ja iniciou tools mutaveis e recuperada para handoff, nao repetida cegamente.

## Orcamento de requisicoes

Saudacao usa normalmente uma chamada logica. Busca, adicao, resumo, confirmacao, status e handoff usam normalmente ate duas (tool e resposta final). O teto defensivo e seis chamadas logicas por evento inbound e tres tentativas HTTP por chamada. Notificacoes automaticas de pedido usam zero chamada NVIDIA.

Estado da revisão de 14/07/2026: **NÃO EXECUTADO — credencial local ausente**.
