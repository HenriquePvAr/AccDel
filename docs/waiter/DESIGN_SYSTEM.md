# Design system do Cain Garçom

## Princípios

A interface prioriza leitura rápida, toque com uma mão, estado operacional explícito e baixa carga cognitiva. Cor nunca é o único indicador: ícone, rótulo e contraste acompanham cada status.

## Tokens e componentes

- Fundo quente neutro, cartões claros, texto grafite e verde como ação primária.
- Amarelo para atenção, vermelho para bloqueio/erro e azul para informação.
- Espaçamento em múltiplos de 4 px, raio moderado e sombras discretas.
- Alvos interativos mínimos de 44 px, foco visível e suporte a `prefers-reduced-motion`.
- `StatusBadge`, cartões de mesa, barra de busca, filtros, stepper, drawer de catálogo, item de comanda, alerta de conexão e navegação responsiva.

## Responsividade

- 360–390 px: navegação inferior fixa, fluxo em uma coluna e ações principais no alcance do polegar.
- 768–1024 px: mais densidade, grades e painel de comanda ampliado.
- 1366 px: navegação lateral e catálogo com maior área útil, sem alongar linhas de leitura.

Os estados cobertos visualmente são login, mesas livres/ocupadas, catálogo, modificadores obrigatórios, rascunho, envio, indisponibilidade, conflito, item pronto, fechamento e offline.
