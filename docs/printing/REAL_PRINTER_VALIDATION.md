# Validação com impressora real

## Classificação atual

**Não executada nesta entrega.** A solução está pronta apenas para um teste supervisionado em restaurante, não para produção autônoma.

## Pré-condições

- aprovação do responsável técnico e do gerente da loja;
- ambiente de piloto sem pedidos reais ou com pedidos de teste claramente identificados;
- impressora ESC/POS de rede com manual, IP reservado e porta RAW confirmada;
- host do agente dedicado, atualizado e com firewall restrito;
- agente ativo em dry-run e painel mostrando configuração correta;
- bobina compatível e operador ao lado da impressora;
- plano de desligamento imediato.

O spooler/USB do Windows não pode ser usado nesta versão.

## Roteiro

1. Imprima uma única página de teste.
2. Confira 58/80 mm, margens, negrito, texto duplo, quebra de linha e corte.
3. Confira todos os acentos PT-BR e o fallback de símbolo/emoji.
4. Valide um pedido inicial com dois itens, adicionais e observação longa.
5. Valide cozinha e bar separados; nenhum item pode aparecer em duas estações.
6. Valide adição, cancelamento, caixa e expedição.
7. Confirme que cozinha/bar não recebem telefone, endereço ou valores.
8. Confirme que expedição recebe telefone mascarado.
9. Gere reimpressão com motivo e confira a marca visível.
10. Interrompa a API antes do claim e confirme recuperação sem duplicação.
11. Interrompa a API após o driver concluir e confirme `SENT_UNCONFIRMED`/confirmação tardia.
12. Simule queda do agente durante o envio somente em pedido fictício; confirme que o resultado vira ambíguo e não repete automaticamente.
13. Observe pelo menos 40 pedidos fictícios com dois setores.
14. Mantenha o piloto supervisionado por um turno antes de qualquer expansão.

## Evidências permitidas

Registre modelo/firmware, papel, code page, hash/ID curto, horário, resultado e códigos de erro. Fotos devem usar apenas conteúdo fictício. Nunca fotografe token, tela de `.env`, telefone real ou endereço real.

## Critérios de aprovação

- zero roteamento cruzado ou vazamento de PII;
- zero duplicação automática após resultado ambíguo;
- acentos e corte corretos em 58/80 mm aplicáveis;
- reimpressão sempre marcada e auditada;
- recuperação de API/agente previsível;
- operador consegue identificar e resolver fila bloqueada pelo runbook;
- nenhum uso do driver Windows não implementado.

Qualquer falha de privacidade, duplicação silenciosa, truncamento que mude o sentido do pedido ou perda de job reprova o piloto.

## Registro final

Após o teste, atualize este documento com data, local de teste, modelo/firmware, cenários aprovados/reprovados e links internos para evidências sanitizadas. Só então reavalie prontidão de produção.
