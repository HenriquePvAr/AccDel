# Plano de redesign operacional

Data: 14/07/2026  
Foco: Central de Pedidos, preparo, cozinha e expedição.  
Restrição: evolução incremental, sem mudança destrutiva de banco/API e sem trocar a stack.

## Resultado pretendido

Transformar a Central em uma superfície de decisão por papel, mantendo `Order` e os endpoints atuais. O operador deve enxergar o próximo trabalho na primeira dobra, distinguir prazo restante de atraso, acompanhar pedidos até a entrega e agir com menos troca de tela.

O redesign não promete capacidades ausentes. Pagamento, edição de pedido, impressão e alertas só entram quando tiverem contrato backend, autorização, idempotência e auditoria.

## Princípios

1. **Fila antes de métrica:** trabalho vivo vem antes de gráficos, resumos e filtros.
2. **Uma fonte, várias projeções:** Preparo e Expedição são visões do mesmo pedido, não cópias.
3. **Papel define a ação:** cozinha prepara; expedição atribui/acompanha; caixa recebe.
4. **Servidor decide:** interface nunca é a autoridade de preço, permissão ou transição.
5. **Exceção é explícita:** atraso, pagamento pendente e nota crítica aparecem por texto e cor.
6. **Mobile é foco, não mini-desktop:** uma fila ativa por vez, ações de 44 px e contexto essencial.
7. **Sem controles cenográficos:** nada de badge, comando, impressão ou alerta sem comportamento real.

## Arquitetura de informação proposta

```text
Central operacional
├── Preparo
│   ├── Em análise
│   ├── Em produção
│   └── Pronto
└── Expedição
    ├── Pronto
    ├── Em rota
    └── Concluído recente
```

“Pronto” é o handoff compartilhado. A presença nos dois modos é intencional e deriva do mesmo registro. Em desktop, o modo mostra três colunas. Em mobile, mostra tabs com contagem e apenas a coluna ativa.

## Primeira entrega: alto impacto, baixo risco

### O que será implementado

- seletor Preparo/Expedição dentro da Central;
- estados Em rota e Concluído recente acessíveis sem trocar de módulo;
- resumo compacto e acionável;
- cards com SLA por `dueAt`, pagamento, origem, nota e driver;
- uma fila por vez no mobile;
- ação direta de acompanhamento para pedido em rota;
- navegação lateral mais compacta e agrupada por trabalho;
- header sem ações/badges falsos, com busca funcional para pedidos;
- funções puras e testes unitários para projeção de filas e SLA.

### O que não será alterado

- Prisma schema, migrações, enums e dados;
- endpoints/payloads;
- cálculo de preços, cupom ou taxa;
- regra de status do backend;
- tela de detalhe além da integração existente;
- KDS completo, pagamento, impressão, edição ou WhatsApp.

## Wireframes

### Desktop

```text
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Cain         │ Buscar pedido...              + Novo pedido   Perfil    │
│              ├──────────────────────────────────────────────────────────┤
│ OPERAÇÃO     │ Central operacional          [Preparo] [Expedição]      │
│ • Central    │ [Todos 6] [Atrasados 2] [Atualizar] [Filtros]          │
│ • Novo       ├─────────────────┬─────────────────┬──────────────────────┤
│ • Cozinha    │ EM ANÁLISE  2   │ EM PRODUÇÃO  3  │ PRONTO  1            │
│ • Expedição  │ #1042  7 min    │ #1040 ATRASADO  │ #1038 Pag. pendente  │
│ • Salão      │ Cliente · App   │ 3 itens · nota  │ Motoboy: não atrib.   │
│ • Caixa      │ Pix · pendente  │ Cartão · pago   │ [Despachar]           │
│              │ [Aceitar]       │ [Marcar pronto] │                       │
└──────────────┴─────────────────┴─────────────────┴──────────────────────┘
```

No modo Expedição as colunas se tornam Pronto, Em rota e Concluído recente. O board ocupa o restante da altura e cada coluna rola internamente quando necessário.

### Mobile

```text
┌────────────────────────────┐
│ ☰ Central          + Novo  │
│ [ Preparo ][ Expedição ]   │
│ [Análise 2][Produção 3][Pronto 1]
│ Buscar...       [Filtros]  │
├────────────────────────────┤
│ #1042       7 min restantes│
│ Marina · Delivery · App    │
│ 2 itens · Pix pendente     │
│ ⚠ Sem cebola               │
│ [       Aceitar       ]    │
├────────────────────────────┤
│ #1041          3 min rest. │
│ ...                        │
└────────────────────────────┘
```

Tabs têm rolagem horizontal apenas quando necessário, nome acessível e alvo mínimo de 44 px. A primeira tarefa deve aparecer em 390×844 sem depender de rolagem vertical inicial.

## Card operacional

### Conteúdo obrigatório

| Bloco | Informação | Regra |
|---|---|---|
| Identidade | número + prioridade | número é dominante; prioridade por texto/ícone |
| Tempo | prazo/atraso real | comparar `dueAt` com agora; encerrados não ficam “atrasados” |
| Destino | cliente + delivery/retirada/mesa | endereço resumido; completo no detalhe |
| Origem | salão, telefone, app, iFood/WhatsApp quando houver | label consistente |
| Itens | quantidade e resumo | notas/modificadores críticos destacados |
| Financeiro | método + status | não inferir “pago” no cliente |
| Entrega | driver no modo Expedição | “Não atribuído” explícito |
| Ação | próxima ação permitida | 44 px, pending bloqueado, estado textual |

### SLA visual

| Condição | Texto | Tom |
|---|---|---|
| `dueAt` > 10 min | “N min restantes” | neutro |
| 1–10 min | “N min restantes” | atenção |
| vencido | “N min atrasado” | crítico |
| concluído/cancelado | “Encerrado” | discreto |
| sem `dueAt` | “Sem previsão” | atenção, sem inventar valor |

## Responsividade

| Largura | Composição |
|---:|---|
| ≥1280 | sidebar 244 px; três colunas; todos os controles principais |
| 768–1279 | sidebar recolhível; três colunas compactas ou scroll horizontal explícito |
| <768 | sem sidebar persistente; uma coluna ativa; tabs; ações full-width |

O detalhe continua em drawer no desktop. No mobile deve ocupar a tela ou usar drawer amplo, preservando voltar e foco.

## Estados da interface

- **Loading:** skeleton com mesma geometria do card; não zerar contadores como se fosse estado real.
- **Empty global:** explicar que nenhum pedido corresponde e oferecer limpar filtros/novo pedido se permitido.
- **Empty de coluna:** mensagem curta específica, sem ocupar a altura toda.
- **Erro:** causa genérica segura, botão Tentar novamente e último conteúdo preservado quando possível.
- **Offline/SSE interrompido:** indicar atualização pausada; polling/retry com backoff.
- **Mutation pending:** ação desabilitada com verbo no gerúndio; não aplicar status definitivo só no cliente.

## Permissões

| Ação | Permissão atual | Direção segura |
|---|---|---|
| Ver Central | `orders:view` | manter, com escopo de loja revalidado |
| Aceitar/pronto/cancelar/despachar | `orders:update` | separar por transição/papel |
| Ver drivers admin | `drivers:view` | separar de self |
| Acompanhar entrega | `drivers:view`/tracking | permissão operacional específica; tracking público tokenizado |
| Criar pedido | `orders:create` | manter com idempotência |

A primeira entrega respeita os guards atuais para não quebrar contratos, mas não representa a matriz final de segurança.

## Instrumentação futura

Eventos sem PII:

- `operations_view_changed` (`preparation|dispatch`);
- `operations_status_tab_changed`;
- `order_primary_action_started|succeeded|failed` com status, papel e duração;
- `order_tracking_opened`;
- `filters_applied|cleared`;
- Web Vitals e tempo até primeiro pedido visível.

Não registrar nome, telefone, endereço, observação livre ou token.

## Critérios de aceite da primeira entrega

- build e lint do painel passam;
- testes de projeção/SLA passam;
- API e driver continuam compilando sem alteração de contrato;
- Preparo mostra análise, produção e pronto;
- Expedição mostra pronto, rota e concluídos recentes;
- mobile mostra apenas uma fila e primeiro card na primeira dobra;
- prazo nunca usa “atrasado” antes de `dueAt`;
- pagamento, origem, nota e driver aparecem quando aplicáveis;
- controles falsos são removidos do header;
- navegação por teclado e nomes acessíveis verificados;
- screenshots desktop/tablet/mobile registradas.

