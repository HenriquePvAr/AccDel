# Design system operacional

Versão inicial: 14/07/2026
Objetivo: dar semântica consistente ao shell escuro e às superfícies de pedidos, cozinha e expedição.

## Fundamentos

O produto já usa Tailwind, Radix e componentes em `src/components/ui`. Esta especificação não cria outra biblioteca: define tokens e padrões para reduzir hard-codes e manter o tema operacional atual. Tokens devem ser CSS custom properties consumidas pelas classes existentes.

### Princípios visuais

- superfície escura reduz brilho em operação longa, mas texto e bordas precisam contraste AA;
- laranja é ação primária, não decoração espalhada;
- cores de estado sempre acompanham texto/ícone;
- densidade é alta com respiro suficiente para escanear;
- números, prazos e totais usam algarismos tabulares;
- animação confirma mudança, nunca distrai a fila.

## Cores semânticas

| Token | Valor inicial | Uso |
|---|---|---|
| `--ops-canvas` | `#06111f` | fundo principal |
| `--ops-sidebar` | `#081522` | navegação |
| `--ops-surface` | `#0d1b2a` | cards/colunas |
| `--ops-surface-raised` | `#122337` | popover/drawer/hover |
| `--ops-border` | `rgba(255,255,255,.10)` | divisores |
| `--ops-text` | `#f8fafc` | texto primário |
| `--ops-text-muted` | `#94a3b8` | metadados |
| `--ops-action` | `#ea580c` | ação primária |
| `--ops-action-hover` | `#f97316` | hover/foco da ação |
| `--ops-info` | `#38bdf8` | análise/informação |
| `--ops-warning` | `#fbbf24` | vence em breve/pendência |
| `--ops-success` | `#34d399` | pronto/concluído |
| `--ops-route` | `#60a5fa` | em rota |
| `--ops-danger` | `#fb7185` | atraso/cancelamento |
| `--ops-focus` | `#fdba74` | anel de foco |

Contraste deve ser medido no par final, inclusive badges translúcidos. Nunca usar texto colorido pequeno sobre fundo de baixa opacidade sem validação.

## Tipografia

Fonte atual do sistema pode ser mantida. Escala operacional:

| Papel | Tamanho/linha | Peso | Uso |
|---|---|---:|---|
| Display | 28/34 px | 750 | título de página desktop |
| Title | 20/28 px | 700 | título mobile/drawer |
| Card ID | 16/22 px | 750 | número do pedido |
| Body | 14/20 px | 500 | cliente, itens e ação |
| Meta | 12/16 px | 600 | origem, pagamento, driver |
| Label | 11/14 px | 700, uppercase | coluna/badge; evitar abaixo de 11 px |

Use `font-variant-numeric: tabular-nums` em pedido, prazo, dinheiro e contadores.

## Espaçamento e geometria

Base de 4 px.

| Token | Valor | Uso |
|---|---:|---|
| `space-1` | 4 px | ícone/texto compacto |
| `space-2` | 8 px | grupos internos |
| `space-3` | 12 px | padding de card compacto |
| `space-4` | 16 px | blocos e mobile gutter |
| `space-6` | 24 px | seção desktop |
| `radius-sm` | 8 px | badge/input |
| `radius-md` | 12 px | botão/card |
| `radius-lg` | 16 px | coluna/drawer |

Ações primárias: mínimo 44 px de altura. Ícones sozinhos: área interativa mínima 44×44 px mesmo quando o desenho tem 16–20 px.

## Elevação e borda

- card normal: borda `--ops-border`, sem sombra pesada;
- card hover/focus: borda mais clara e ring de foco;
- popover/drawer: superfície raised + sombra curta;
- atraso: faixa/borda esquerda danger, não card inteiro vermelho;
- item selecionado: ring de 2 px, preservando contraste.

## Componentes

### Seletor de modo

- controle segmentado com `role="tablist"` quando alterna conteúdo local;
- labels “Preparo” e “Expedição” sempre visíveis;
- selecionado usa fundo action discreto, texto claro e `aria-selected`;
- persiste durante atualização; não depende apenas de cor.

### Tabs de fila mobile

- altura 44 px;
- nome + contador;
- scroll horizontal com bordas/fade visíveis se exceder largura;
- tab ativa move foco de conteúdo para heading apenas quando iniciado por teclado, evitando salto em toque.

### Coluna

- heading sticky com label, contagem e tom semântico;
- empty state específico: “Nenhum pedido em produção”;
- rolagem interna só em desktop com altura previsível;
- não esconder scrollbar necessária para descoberta.

### Card de pedido

- `article` com heading identificável;
- card inteiro abre detalhe, mas ações internas não propagam clique;
- ordem visual/DOM idêntica;
- SLA e status têm texto;
- nota livre truncada na lista, completa no detalhe;
- endereço e telefone minimizados na lista por privacidade;
- ação primária full-width em mobile.

### Badges

| Tipo | Exemplo | Tom |
|---|---|---|
| Status | Em produção | warning |
| SLA | 8 min atrasado | danger |
| Pagamento | Pix pendente | warning |
| Origem | WhatsApp | info/neutro |
| Prioridade | Prioritário | danger com ícone |

Máximo recomendado: três badges na área superior; demais dados viram linhas de metadados.

### Filtros

- busca principal sempre visível;
- origem/status avançados em popover no desktop e sheet no mobile;
- botão mostra quantidade de filtros ativos;
- “Limpar” é explícito;
- resumo pode aplicar filtro, mas deve anunciar estado pressed/selected.

### Feedback

- toast para confirmação não crítica;
- erro de mutação também permanece próximo da ação;
- skeleton replica card sem animação agressiva;
- spinner nunca substitui todo o label: “Atualizando…”;
- otimistic UI somente quando há rollback seguro e idempotência.

## Interação e movimento

- hover/focus: 120–160 ms;
- entrada de drawer: 180–220 ms;
- mudança de coluna: realce curto, sem mover o card antes da confirmação server-side;
- respeitar `prefers-reduced-motion`;
- não animar contadores a cada polling/SSE.

## Conteúdo

Padrões de linguagem:

- verbos concretos: “Aceitar pedido”, “Marcar pronto”, “Despachar”, “Acompanhar”;
- pending: “Aceitando…”, “Despachando…”;
- prazos: “7 min restantes”, “3 min atrasado”, “Sem previsão”;
- empty: “Nenhum pedido pronto para expedição”;
- erro: “Não foi possível atualizar os pedidos. Tentar novamente”.

Evitar “Sucesso!”, “Ops!”, abreviações ambíguas e afirmações de segurança não verificadas.

## Acessibilidade

- WCAG 2.2 AA como referência;
- foco visível de 2 px com offset;
- labels programáticas em icon buttons;
- `aria-current="page"` na navegação e `aria-live="polite"` apenas em feedback;
- modal/drawer prende e devolve foco;
- atalho de pular para conteúdo principal;
- status não depende de cor;
- zoom a 200% sem perda de ação;
- teste em 390×844, 768×1024, 1024×768 e 1366×768.

## Do / Don't

| Faça | Não faça |
|---|---|
| Compare `dueAt` antes de dizer atraso | Chamar idade do pedido de atraso |
| Mostre pagamento como reportado pelo servidor | Inferir pago pela forma escolhida |
| Oculte recurso ainda inexistente | Renderizar botão sem callback |
| Use uma ação primária clara | Exibir cinco CTAs equivalentes no card |
| Minimize PII na lista | Mostrar telefone/endereço completo em todas as filas |
| Preserve confirmação destrutiva | Reduzir cliques removendo segurança |

