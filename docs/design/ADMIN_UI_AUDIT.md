# Auditoria visual do Admin

Data da auditoria: 16/07/2026

Base validada: `ci/pilot-rc2-validation` em `30a8b5305d9ccb081d6e0d6028acd32650ba3e6a`

Branch de trabalho: `feat/admin-ui-redesign`

## Escopo e método

A auditoria foi feita antes de qualquer alteração visual. O Admin foi executado com os mocks já existentes e uma sessão local fictícia restrita aos endpoints de autenticação. Nenhum serviço externo, banco de produção, integração de mensagens, impressão física ou aplicativo adjacente foi acessado.

Foram inspecionadas as 28 rotas declaradas pelo roteador, os estados de carregamento, erro e ausência de dados, os componentes compartilhados e os viewports `1440x900`, `1280x720`, `1024x768`, `768x1024` e `390x844`. As capturas comparativas são temporárias e não fazem parte do repositório.

## Rotas auditadas

- Acesso e erro: `/login`, rota inexistente.
- Operação: `/dashboard`, `/operations/readiness`, `/orders`, `/orders/new`, `/orders/:orderId`, `/kitchen`, `/cash`, `/cash-register`.
- Salão e entrega: `/dining/tables`, `/dining/waiters`, `/drivers`, `/drivers/location`.
- Relacionamento: `/customers`, `/ai-attendant`.
- Catálogo: `/catalog/categories`, `/catalog/products`, `/catalog/promotions`, `/catalog/coupons`, `/catalog/preview`.
- Gestão: `/history/orders`, `/reports`.
- Configurações: `/settings/store`, `/settings/users`, `/settings/delivery`, `/settings/payments`, `/settings/preferences`, `/settings/printing`.

## Componentes e padrões auditados

- shell, sidebar recolhível, drawer móvel, header, seletor de loja e navegação protegida;
- títulos de página, cards de métricas, gráficos, badges, filtros, busca e estados vazios;
- quadro operacional, cards de pedido, drawers, diálogos de confirmação e ações de status;
- tabelas/listas de clientes, catálogo, equipe, caixa, histórico e configurações;
- formulários, inputs, selects, switches, tabs, skeletons, alertas e toasts;
- área de Atendente IA, abas, conversas, WhatsApp, base, ajustes e teste;
- mapas e tracking somente na superfície visual local, sem acessar serviços reais.

## Diagnóstico inicial

### P0 — coerência do produto

1. Há dois sistemas visuais concorrentes: tokens claros e quentes na fundação, mas o shell e a maior parte das páginas usam valores escuros arbitrários. Isso torna contraste, manutenção e evolução imprevisíveis.
2. Gradientes radiais, blur, glows, bordas translúcidas e sombras profundas aparecem simultaneamente. A decoração compete com número do pedido, SLA e próxima ação.
3. A sidebar apresenta mais de vinte destinos em cinco grupos e precisa de rolagem própria mesmo em `1440x900`. O operador perde contexto e o rodapé de recolhimento concorre com a navegação.
4. O header repete contexto de loja/perfil em grandes cápsulas. Em páginas operacionais, a busca global e a busca local competem pela mesma atenção.

### P0 — operação

1. Pedidos têm boa cobertura de dados, mas o excesso de contorno, cor e badges reduz a velocidade de leitura. Número, SLA, cliente, pagamento e ação principal não formam uma hierarquia suficientemente nítida.
2. No desktop, colunas e cards usam sombras e rings sobrepostos; no mobile a estrutura é funcional, porém ainda visualmente pesada e com primeira dobra apertada.
3. O dashboard ocupa grande área com cards aninhados e realces decorativos. Indicadores reais ficam com peso visual semelhante a descrições e estados secundários.
4. A área de IA abre com seis skeletons sem explicar o que está sendo carregado nem oferecer contexto de indisponibilidade durante espera prolongada.

### P1 — consistência e densidade

1. Radius variam de 8 a 28 px sem relação clara com hierarquia.
2. Botões primários usam gradiente, glow, pseudo-elementos e movimento vertical; ações secundárias também elevam no hover. Isso cria ruído em interfaces de uso contínuo.
3. Textos operacionais importantes aparecem entre 10 e 11 px e em caixa alta com tracking amplo.
4. Cards dentro de cards são frequentes no dashboard, configurações, IA e painéis de detalhes.
5. Algumas páginas usam componentes compartilhados; outras reproduzem superfícies, cabeçalhos, tabelas e estados com classes locais.

### P1 — acessibilidade

1. Cinco rotas apresentaram campos sem rótulo programático detectável: Pedidos, Cozinha, Tracking de entregadores, Categorias e Histórico.
2. A rota 404 não possui landmark `main`.
3. Há foco visível em diversos componentes, mas o offset escuro e as cores locais não formam um padrão único.
4. Estados normalmente incluem texto, porém a intensidade de cor ainda é usada em excesso para criar hierarquia.
5. Alguns controles compactos ficam abaixo do alvo confortável de 44 px no tablet/mobile.

### P2 — performance e estabilidade visual

1. O console não apresentou erros, mas registrou quatro warnings do Recharts porque containers foram medidos com largura e altura `-1` durante montagem.
2. O build inicial gera CSS principal de `125,74 kB` (`34,08 kB` gzip).
3. O maior chunk de entrada tem `538,58 kB` (`172,25 kB` gzip). A página de tracking, que inclui o mapa, permanece como chunk separado de `1.156,50 kB` (`311,91 kB` gzip).
4. O code splitting por rota já existe e deve ser preservado. O redesign não justifica introduzir nova biblioteca visual.

## Resultado das medições

- 28/28 rotas protegidas ou de erro carregaram e apresentaram um `h1` após estabilização.
- 27/28 rotas apresentaram landmark `main`; a exceção é a rota 404.
- Zero overflow horizontal do documento nos cinco viewports medidos.
- Zero botões sem nome acessível detectados na amostra estabilizada.
- Cinco rotas com pelo menos um campo sem label programático.
- Zero erros de console e quatro warnings de dimensionamento dos gráficos.
- Login, logout, proteção de rota e redirecionamento para Pedidos funcionaram com a sessão local fictícia.

## Baseline de qualidade

- `npm run build`: aprovado.
- `npm run lint`: zero erros e quatro warnings React já conhecidos, todos na área de entregadores/tracking.
- `npm test`: 5/5 testes aprovados.
- Worktree limpa antes da auditoria e branch criada a partir do hash exato solicitado.

## Direção recomendada

Adotar uma base clara e neutra, com sidebar grafite, superfícies brancas, uma única cor principal laranja queimado e cores semânticas reservadas a estado. A fundação deve reduzir radius, sombras e bordas; organizar o shell em navegação compacta; criar cabeçalho de página previsível; tornar dados e ações mais importantes que decoração; e preservar todos os contratos e fluxos existentes.

## Limites desta auditoria

- Dados reais, providers de IA, WhatsApp, impressão física e mapas externos não foram acionados.
- Métricas visuais foram obtidas com dados mock já existentes; nenhum dado fictício foi adicionado ao código de produção.
- A auditoria não altera RBAC, regras de estado, contratos, backend ou banco.
