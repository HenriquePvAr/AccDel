# Sistema visual do Admin

## Princípios

1. Trabalho antes de decoração: fila, exceção e próxima ação recebem maior contraste.
2. Uma identidade: laranja queimado é a única cor de marca; cores adicionais têm significado operacional.
3. Superfícies claras: o canvas é neutro, cards são brancos e a sidebar grafite cria orientação.
4. Densidade confortável: componentes compactos, sem sacrificar leitura ou alvo de toque.
5. Estado por mais de um sinal: texto, ícone e posição acompanham a cor.
6. Movimento funcional: transições entre 120 e 180 ms; nenhuma animação contínua fora de loading.
7. Contratos preservados: o sistema visual não decide permissões, transições ou valores.

## Tokens

### Cores

| Token | Valor | Uso |
|---|---|---|
| `--ui-canvas` | `#f6f7f8` | fundo do Admin |
| `--ui-surface` | `#ffffff` | cards, header e drawers |
| `--ui-surface-subtle` | `#f1f3f5` | áreas agrupadas e estados neutros |
| `--ui-sidebar` | `#182026` | navegação principal |
| `--ui-sidebar-hover` | `#242e35` | hover na navegação |
| `--ui-ink` | `#20262b` | texto principal |
| `--ui-ink-muted` | `#667078` | texto secundário |
| `--ui-ink-subtle` | `#8a949b` | metadado de baixa ênfase |
| `--ui-border` | `#dde2e5` | divisor e contorno padrão |
| `--ui-border-strong` | `#c7ced3` | contorno ativo |
| `--ui-brand` | `#c65d2e` | ação primária e rota ativa |
| `--ui-brand-hover` | `#aa4a22` | hover da ação primária |
| `--ui-focus` | `#2d6cdf` | foco visível |
| `--ui-info` | `#246b9e` | informação/análise |
| `--ui-warning` | `#9a6500` | atenção/prazo curto |
| `--ui-success` | `#16745a` | pronto/sucesso |
| `--ui-danger` | `#b23a38` | atraso/erro/cancelamento |

As cores semânticas usam fundo com 8–12% de intensidade e texto escuro. Laranja não é usado para decorar superfícies inteiras.

### Tipografia

- Família: Plus Jakarta Sans; JetBrains Mono somente para pedido, dinheiro, tempo e identificadores.
- Título de página: 28/34 px, peso 700; mobile 24/30 px.
- Título de seção: 18/26 px, peso 700.
- Título de card: 15/22 px, peso 650–700.
- Corpo: 14/21 px, peso 400–500.
- Metadado: 12/18 px, peso 500–600; nunca abaixo de 12 px para informação operacional.
- Números usam `font-variant-numeric: tabular-nums`.

### Geometria e espaço

- Escala: 4, 8, 12, 16, 20, 24, 32 e 40 px.
- Radius: 6 px em badges, 8 px em inputs/botões, 12 px em cards, 16 px somente em modais/drawers.
- Sidebar: 232 px aberta e 68 px recolhida.
- Header: 64 px em desktop e 60 px em telas menores.
- Conteúdo: máximo 1600 px; gutters 32 px desktop, 24 px tablet e 16 px mobile.
- Touch target: mínimo 44x44 px em ações essenciais e controles de ícone no mobile.

### Elevação e bordas

- Card: borda de 1 px e sombra `0 1px 2px rgba(16,24,40,.04)`.
- Popover/drawer: sombra `0 16px 40px rgba(16,24,40,.14)`.
- Ações e cards não se deslocam verticalmente no hover.
- Um agrupamento pode usar fundo ou borda; evitar os dois quando não há necessidade.

### Movimento, foco e camadas

- Transição rápida: 120 ms; padrão: 160 ms; drawer: 200 ms.
- `prefers-reduced-motion` desativa movimento e reduz skeleton a uma troca de opacidade discreta.
- Foco: ring azul de 2 px com offset branco ou canvas.
- Camadas: conteúdo `0`, header `30`, overlay `40`, drawer/modal `50`, toast `80`.

## Componentes

### Shell e navegação

- Sidebar grafite fixa no desktop e drawer abaixo de `1024 px`.
- Rota ativa usa superfície ligeiramente clara, texto branco e barra laranja de 3 px.
- Grupos permanecem acessíveis, mas são compactos e semanticamente ordenados.
- Header contém menu, busca contextual, ação Novo pedido, loja e menu de usuário; sem badges ou comandos cenográficos.

### Cabeçalho de página

- Um `h1`, descrição curta opcional e ações à direita.
- Eyebrow é texto simples em laranja, não uma cápsula decorativa.
- Ação primária aparece uma vez e permanece visível nos breakpoints suportados.

### Cards e indicadores

- Superfície branca, radius 12 px, borda discreta e sem pseudo-elemento de brilho.
- Indicador usa label, valor e contexto; tendência só quando existe fonte real.
- Cards operacionais colocam identidade e tempo na primeira linha, contexto no meio e ação no rodapé.

### Formulários

- Label real associado ao controle; placeholder apenas como exemplo.
- Inputs de 42 px no desktop e 44 px em contexto touch.
- Erro logo abaixo do campo; ajuda é visualmente secundária.
- Ação de salvar informa pending e bloqueia novo envio conforme a lógica já existente.

### Tabelas e listas

- Cabeçalho com fundo sutil, 12 px sem caixa alta excessiva; linha mínima de 48 px.
- Colunas numéricas à direita e identificadores tabulares.
- Desktop usa tabela; telas estreitas preservam scroll controlado ou composição em cards já existente.

### Estados

- Loading mantém a geometria final e inclui texto de contexto quando a espera é prolongada.
- Vazio explica o estado e apresenta somente uma ação útil.
- Erro informa ocorrência, impacto e tentativa possível; nunca exibe stack trace.
- Offline, conflito, bloqueio e indisponibilidade têm label explícito e ícone, sem depender da cor.

## Responsividade

- `>=1280 px`: sidebar aberta e quadro com múltiplas colunas.
- `1024–1279 px`: sidebar em drawer; conteúdo com gutters de tablet.
- `768–1023 px`: layout de uma coluna ou tabs; ações principais preservadas.
- `<768 px`: consulta emergencial, uma fila de pedido ativa e detalhes em drawer amplo.
- `390 px` é a largura mínima de validação; não deve existir overflow horizontal do documento.

## Acessibilidade

- Referência WCAG 2.2 AA.
- Landmarks, heading único, `aria-current`, labels programáticos e nomes em botões de ícone.
- Ordem DOM acompanha a ordem visual; modais prendem e devolvem foco.
- Status nunca depende apenas de cor e texto importante não usa tamanho menor que 12 px.
- Contraste, teclado, zoom e `prefers-reduced-motion` entram na revisão visual final.
