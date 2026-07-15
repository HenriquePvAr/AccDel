# Critérios de sucesso e interrupção

## Sucesso obrigatório

| Métrica | Meta |
| --- | --- |
| Pedidos perdidos | 0 |
| Pedidos duplicados | 0 |
| Impressões duplicadas não justificadas | 0 |
| Preço divergente do backend/cardápio aprovado | 0 |
| Acesso entre lojas/usuários indevidos | 0 |
| Pagamento duplicado | 0 |
| Pedidos sem trilha/auditoria | 0 |
| Conflitos não recuperados | 0 |
| Disponibilidade durante janela | ≥ 99% na fase limitada |

Registrar também p50/p95 de envio do pedido e criação/claim/impressão, falhas por dispositivo, retries manuais, acionamentos de suporte, satisfação dos garçons (1–5) e minutos de treinamento até operação assistida. A fase 0 mede latência local; metas numéricas definitivas são definidas após restaurante fechado, sem inventar capacidade da rede/impressora.

## Interrupção imediata

Parar entrada de novos pedidos e voltar ao processo manual se ocorrer qualquer um:

- pedido perdido/duplicado ou atribuído à loja errada;
- preço, desconto ou pagamento divergente/duplicado;
- acesso indevido, segredo/PII exposto ou tracking além do mínimo;
- banco inconsistente, migration inesperada ou restore não confiável;
- impressão em loop ou impossibilidade de distinguir impresso de desconhecido;
- sistema manual e Cain não podem ser reconciliados;
- responsável de suporte/rollback indisponível.

## Pausa controlada

Pausar apenas o componente afetado quando há fila crescente, agente/dispositivo offline, p95 acima do aceitável por 10 minutos, mais de dois conflitos não compreendidos, bateria/rede instável ou necessidade recorrente de repetir ações. Desativar via flag e manter operação manual.

## Go/no-go

Ao fim de cada fase, gerente, operação e suporte revisam métricas, incidentes, backup, hardware e pendências. Ausência de incidente não elimina gates pendentes. A decisão e o commit exato devem ser registrados fora deste repositório com os responsáveis.
