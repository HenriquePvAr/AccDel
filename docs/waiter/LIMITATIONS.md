# Limitações e classificação

## Não validado fisicamente

- impressão em equipamento térmico real e roteamento de setores no restaurante;
- comportamento em Wi-Fi congestionado, suspensão de tela e dispositivos Android/iOS reais;
- instalação PWA em todos os navegadores/MDM alvo;
- turno real com múltiplos garçons, cozinha e caixa.

## Limites técnicos conhecidos

- ícone PWA em SVG é provisório; gerar PNG maskable antes de distribuição ampla;
- não há fila offline de mutações por decisão de segurança operacional;
- SSE é por instância e usa polling como fallback; escala horizontal exige barramento compartilhado;
- rate limit é local à instância;
- métricas são locais, sem painel/alerta externo;
- não há revogação central imediata de JWT nem pentest independente;
- o app não realiza pagamento nem libera mesa;
- spooler Windows do Cain Print Agent continua não implementado.

## Classificação honesta

O software está **pronto para piloto supervisionado em staging**, com dados de teste e plano de rollback. Não está homologado para produção autônoma. O gate seguinte é teste integrado em dispositivo e impressora físicos, seguido por correções e um turno controlado.
