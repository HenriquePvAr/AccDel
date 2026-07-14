# Fluxos atuais e metas de eficiência

Data: 14/07/2026  
Contagem: ações intencionais de clique/toque após o operador já estar autenticado; digitação e seleção de conteúdo são indicadas separadamente quando relevantes.

## Visão geral

| # | Tarefa | Fluxo atual | Ações atuais | Principal atrito/risco | Fluxo proposto | Meta |
|---:|---|---|---:|---|---|---:|
| 1 | Criar pedido delivery | Novo pedido → buscar/criar cliente → usar cliente → continuar → adicionar/configurar itens → pagamento → confirmar | 7–9 | Duas etapas, formulário longo de cliente, 15 categorias e resumo distante | Busca única → cliente/endereço inline → adicionar itens → revisar/confirmar | 4–5 |
| 2 | Criar pedido de mesa | Novo pedido → trocar para mesa → escolher mesa → abrir/continuar comanda → itens → salvar/enviar | 6–8 | Alternância de contexto e dois agregados (`TableSession`/`Order`) | Mesa → itens → enviar à produção com confirmação contextual | 4 |
| 3 | Adicionar item | Clicar produto; se houver opção, abrir/configurar/confirmar | 1 simples; 3–6 configurável | Cards grandes e categorias longas; opção pode interromper ritmo | Busca/categoria fixa + configuração compacta com padrões seguros | 1 simples; 2 configurável |
| 4 | Marcar item indisponível | Produtos → localizar/buscar → abrir/alternar disponibilidade | 4–5 | Sai da operação e pode confundir edição com indisponibilidade imediata | Ação rápida “Esgotou” no contexto operacional, com confirmação | 2 |
| 5 | Corrigir pedido confirmado | Não há edição segura; abrir detalhe e normalmente cancelar/refazer | N/D; workaround ≥3 | Erro persiste ou duplica trabalho; sem auditoria de edição | Editar antes da produção, recalcular no servidor e registrar before/after | 2–3 |
| 6 | Enviar à cozinha | Delivery: switch “enviar à produção” + confirmar; mesa: salvar/enviar | 2 | Sem estado explícito de envio/idempotência | Ação primária única com feedback e bloqueio de retry | 1 |
| 7 | Marcar em produção | Cozinha/Central → ação primária | 1 | Backend aceita transições inválidas e ator do cliente | Uma ação, transição server-side validada | 1 |
| 8 | Marcar pronto | Cozinha/Central → ação primária | 1 | Pode ser disparada simultaneamente; handoff pouco explícito | Uma ação idempotente + confirmação visual na Expedição | 1 |
| 9 | Atribuir motoboy | Coluna Pronto → Despachar → escolher driver → confirmar | 3 | Disponibilidade/carga exige inspeção; permissão é ampla demais | Despachar → sugestão/seleção com carga e ETA → confirmar | 2 |
| 10 | Marcar saiu para entrega | O mesmo despacho já muda para `out_for_delivery` | 3 | Atribuição e saída são coladas; sem etapa de conferência | Atribuir/confirmar saída em um fluxo explícito e auditado | 2 |
| 11 | Registrar pagamento | Não existe workflow de pagamento dedicado; não-caixa nasce pago | N/D | Falsa liquidação e ausência de conciliação | Abrir cobrança → confirmar via provedor/ação autorizada | 2 |
| 12 | Identificar atraso | Ver resumo “Atrasados” e escanear cards/tempo | 1–2 | Texto “N min atrás” confunde idade com atraso; resumo não filtra | SLA semântico no card + filtro acionável | 1 |
| 13 | Reimprimir pedido | Botões visuais existem em detalhe, mas callbacks/contrato não | N/D | Aparência de função sem execução | Detalhe → Reimprimir → escolher destino/confirmar | 2 |
| 14 | Cancelar pedido | Card/drawer → Cancelar → confirmar | 2 | Motivo e impacto em pagamento/estoque não são estruturados | Cancelar → motivo obrigatório + consequências claras | 2 |
| 15 | Acompanhar entrega | Pedido em rota não aparece no board; ir a Localização e selecionar, ou abrir histórico/detalhe | 2–3 | Troca de módulo, rota escondida, tracking público expõe PII | Modo Expedição → Acompanhar no card | 1 |

## 1. Criar pedido delivery

Fluxo observado:

```text
Central → Novo pedido → buscar cliente → Usar este cliente
→ Continuar para montar o pedido → escolher produto
→ configurar item (quando necessário) → escolher pagamento
→ Confirmar pedido
```

O passo 1 mistura localizar e cadastrar cliente. Novo cliente exige formulário extenso. O passo 2 usa uma coluna de 15 categorias, grade de produtos e resumo. O botão só habilita após item válido, um bom controle. Preços e descontos são recalculados pelo backend, também positivo.

Riscos: pagamento não-caixa nasce como pago; clique repetido não tem idempotência; o número do pedido pode colidir em concorrência.

## 2. Criar pedido de mesa

O operador alterna o tipo de atendimento, escolhe mesa/comanda e adiciona itens. Itens ficam em `TableSessionItem`; ao enviar à produção, o serviço cria snapshots de `Order`. Essa materialização precisa ser idempotente e observável para o operador não criar duplicidade ou achar que um item foi enviado quando apenas ficou salvo.

## 3. Adicionar/configurar item

Produto simples exige um clique. Produtos com opções abrem configuração e podem exigir várias seleções. A regra deve continuar sendo validada pelo servidor. A otimização segura é preservar padrões válidos, manter quantidade/observação junto do item e evitar fechar/reabrir a grade sem necessidade.

## 4. Marcar indisponibilidade

Hoje é um fluxo de catálogo. Durante pico, cozinha/atendimento precisam interromper o trabalho e navegar para Produtos. A futura ação rápida deve exigir `catalog:update`, mostrar o escopo da loja e permitir reversão; não deve alterar estoque por estado apenas local.

## 5. Corrigir pedido confirmado

Não há contrato de edição do pedido confirmado. A interface não deve inventá-lo. A solução precisa definir janela de edição (por exemplo, antes de produção), recalcular valores, tratar cupom/pagamento, versionar o pedido e auditar alterações. Até isso existir, cancelamento/refação deve explicar consequências.

## 6–8. Handoff para cozinha

Ações são curtas, mas os limites de papel não são: o mesmo `orders:update` alcança status downstream. O ideal é uma máquina de estados no servidor:

```text
Em análise --aceitar--> Em produção --pronto--> Pronto
```

Cada transição deve considerar estado atual, papel, versão e chave idempotente. O cliente nunca fornece a identidade do ator.

## 9–10. Atribuir e despachar

O diálogo de despacho já é uma boa barreira contra atribuição acidental. Deve melhorar a decisão com disponibilidade, carga, distância/ETA e alertas. A API precisa separar permissão administrativa da permissão self do entregador e executar pedido + assignment + disponibilidade em transação.

## 11. Registrar pagamento

Capacidade não implementada. O estado “pago” não deve derivar apenas da escolha Pix/cartão. O fluxo futuro deve criar tentativa pendente, receber confirmação autenticada, ser idempotente e registrar conciliação/estorno. Ações manuais precisam de permissão específica e auditoria.

## 12. Identificar atraso

O board usa uma função de idade desde `createdAt` com sufixo “atrás”. Isso não equivale a atraso. A regra visual segura usa `dueAt`:

- mais de 10 min restantes: normal;
- 1–10 min restantes: atenção;
- `dueAt` vencido: atrasado;
- concluído/cancelado: encerrado, sem alerta de SLA vivo.

Essa é uma regra de apresentação; o backend deve futuramente centralizar o SLA por loja/modalidade.

## 13. Reimprimir

`OrderActionBar` renderiza “Imprimir cupom” e “Imprimir resumo”, mas as props são opcionais e a tela de detalhe não liga implementação. Não há endpoint, fila, template, destino ou audit trail. A UI deve esconder/desabilitar honestamente até o contrato existir.

## 14. Cancelar

Há confirmação, mas falta motivo estruturado, autorização por etapa e consequências sobre pagamento, cupom, caixa e driver. Um cancelamento após preparo/rota exige política diferente do cancelamento em análise.

## 15. Acompanhar entrega

O board atual não renderiza `out_for_delivery`. A operação troca para Localização/Histórico e procura o pedido. O redesign inicial resolve a descoberta ao incluir Em rota no modo Expedição e abrir tracking com uma ação. O endpoint público ainda precisa de token opaco e minimização de PII.

## Critérios para aceitar melhorias de fluxo

- redução de ações não pode remover confirmação de operação destrutiva;
- ação visual só existe quando há contrato real e autorização;
- mutações bloqueiam repetição enquanto pendentes e exibem resultado recuperável;
- toda decisão financeira e de autorização é validada pelo servidor;
- atalhos mantêm teclado, leitor de tela e alvo de toque adequado;
- nenhum ganho depende de alterar ou apagar dados existentes.

