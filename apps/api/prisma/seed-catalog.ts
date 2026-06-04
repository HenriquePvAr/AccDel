import type { PrismaClient, ProductChannel } from '@prisma/client'

const images = {
  combo: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  sandwich: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=900&q=80',
  lasagna: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=900&q=80',
  drink: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80',
  juice: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80',
  iceCream: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80',
  dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80',
  soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80',
  fries: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80',
  sauce: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=900&q=80',
}

type CatalogCategorySeed = {
  id: string
  name: string
  description: string
  sortOrder: number
}

type ProductOptionSeed = {
  id: string
  name: string
  description?: string
  image?: string
  priceDelta?: number
  available?: boolean
  soldOut?: boolean
  sortOrder: number
}

type OptionGroupSeed = {
  id: string
  name: string
  description: string
  sortOrder: number
  options: ProductOptionSeed[]
}

type ProductOptionGroupLinkSeed = {
  groupId: string
  required: boolean
  minSelections: number
  maxSelections: number
  sortOrder: number
  description?: string
}

type ProductSeed = {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image: string
  featured: boolean
  preparationStation: string
  tags: string[]
  optionGroups?: ProductOptionGroupLinkSeed[]
  channels?: ProductChannel[]
}

type FlavorRow = readonly [name: string, description?: string, priceDelta?: number]
type SimpleProductRow = readonly [id: string, name: string, description: string, price: number]

const categories: CatalogCategorySeed[] = [
  category('cat_combos', 'Combos', 'Combos promocionais do cardápio atual.', 1),
  category('cat_pizzas', 'Pizzas', 'Pizzas por tamanho, fatia e regras de sabores.', 2),
  category('cat_lasanhas', 'Lasanhas', 'Lasanhas por tamanho com sabor obrigatório.', 3),
  category('cat_burgers', 'Burguers', 'Burguers artesanais do Cain Burger House.', 4),
  category('cat_sandwiches', 'Sanduíches', 'Sanduíches tradicionais e regionais.', 5),
  category('cat_beverages', 'Bebidas', 'Refrigerantes, guaraná e água.', 6),
  category('cat_juices', 'Sucos', 'Sucos por tamanho com sabor obrigatório.', 7),
  category('cat_ice_creams', 'Sorvetes', 'Caixas de sorvete por peso e sabores.', 8),
  category('cat_desserts', 'Sobremesas', 'Sobremesas, saladas de frutas, milkshakes e waffle.', 9),
  category('cat_soup', 'Sopa', 'Sopas do cardápio atual.', 10),
  category('cat_starters', 'Entradas', 'Batatas e entradas quentes.', 11),
  category('cat_sauces', 'Molhos', 'Molhos avulsos e sachês grandes.', 12),
  category('cat_addons', 'Adicionais', 'Adicionais avulsos usados na montagem dos itens.', 13),
]

const pizzaFlavorRows: FlavorRow[] = [
  ['Muçarela', 'Queijo muçarela, tomate, azeitonas e orégano.'],
  ['Margherita', 'Queijo muçarela, manjericão, tomate, azeitonas e orégano.'],
  ['Calabresa', 'Queijo muçarela, calabresa, tomate, azeitonas e orégano.'],
  ['Portuguesa', 'Queijo muçarela, presunto, milho verde, ervilha, ovos, tomate, azeitonas e orégano.'],
  ['Presunto', 'Queijo muçarela, presunto, tomate, azeitonas e orégano.'],
  ['Catupiry', 'Queijo muçarela, queijo catupiry, tomate, azeitonas e orégano.'],
  ['Milho verde', 'Queijo muçarela, milho verde, tomate, azeitonas e orégano.'],
  ['Mista', 'Queijo muçarela, calabresa, presunto, tomate, azeitonas e orégano.'],
  ['Amazonense', 'Queijo muçarela, tucumã, tomate, azeitona e orégano.'],
  ['Frango com Catupiry', 'Queijo muçarela, frango desfiado, catupiry, tomate, azeitonas e orégano.'],
  ['Quatro queijo', 'Queijo muçarela, catupiry, parmesão, queijo coalho, tomate, azeitonas e orégano.'],
  ['Bacon', 'Queijo muçarela, bacon, tomate, azeitonas e orégano.'],
  ['Atum', 'Queijo muçarela, atum, tomate, azeitonas e orégano.'],
  ['Caipira', 'Frango desfiado, catupiry, milho, parmesão, tomate, azeitonas e orégano.', 15],
  ['Brasileira', 'Queijo muçarela, atum, ovos, tomate, azeitonas e orégano.'],
  ['Caboquinha', 'Queijo muçarela, banana frita, tomate, azeitonas e orégano.'],
  ['A moda da casa Manoa', 'Queijo muçarela, carne em tiras, batata palha, tomate, azeitonas e orégano.'],
  ['A Moda Cidade Nova', 'Molho de tomate, muçarela, carne em isca, batata palha, tomate, cebola, pimentão, azeitona e orégano.'],
  ['Bolonhesa', 'Queijo muçarela, carne moída, bacon, catupiry, ervilha, tomate, azeitonas e orégano.', 15],
  ['Espanhola', 'Queijo muçarela, atum, ervilha, palmito, tomate, azeitonas e orégano.'],
  ['Sertaneja', 'Molho de tomate, muçarela, carne desfiada, queijo coalho e orégano.', 15],
  ['Jardineira', 'Queijo muçarela, frango desfiado, bacon, tomate, azeitonas e orégano.'],
  ['Pinguim Premium', 'Queijo muçarela, carne desfiada, catupiry, alho frito, azeitonas e orégano.', 15],
  ['Cinco queijos', 'Muçarela, coalho, catupiry, parmesão, cheddar, tomate, azeitonas e orégano.'],
  ['Bahia', 'Queijo muçarela, calabresa, catupiry, parmesão, manjericão, pimenta calabresa, azeitonas e orégano.'],
  ['Romanesca', 'Queijo muçarela, presunto, bacon, parmesão, catupiry, tomate, azeitonas e orégano.', 15],
  ['Siciliana', 'Queijo muçarela, bacon, palmito, tomate, azeitonas e orégano.'],
  ['Isca com fritas', 'Molho de tomate, muçarela, filé mignon, batata frita, tomate, cebola, azeitona e orégano.', 15],
  ['Nordestina', 'Molho de tomate, muçarela, carne desfiada, banana pacovã frita, cebola, tomate, azeitona e orégano.', 15],
  ['Caboquinha Especial', 'Molho de tomate, muçarela, banana pacovã frita, tucumã, tomate, azeitona e orégano.', 15],
  ['Toscana', 'Queijo muçarela, catupiry, parmesão, calabresa moída, ovos, tomate, azeitonas e orégano.'],
  ['Americana', 'Molho de tomate, muçarela, bacon, ovos, catupiry, cheddar, parmesão, azeitonas e orégano.', 15],
  ['Pizzaiolo', 'Molho de tomate, muçarela, calabresa, frango desfiado, milho, palmito, catupiry, tomate, cebola, pimentão e orégano.', 15],
  ['Alho frito', 'Molho de tomate, muçarela, alho frito, cebola, tomate, pimentão, azeitona e orégano.'],
  ['Bacon com catupiry', 'Molho de tomate, muçarela, bacon em cubos, tomate, pimentão, azeitona e orégano.'],
  ['Frango', 'Molho de tomate, muçarela, frango desfiado, milho, ervilha, tomate, cebola, pimentão, azeitona e orégano.'],
  ['Peperoni', 'Molho de tomate, muçarela, pepperoni, azeitona e orégano.', 20],
  ['Sensação', 'Molho de tomate, muçarela, camarão, jambu, tomate, cebola, pimentão, orégano, azeitona e tucupi à parte.', 15],
  ['Pinguim Especial', 'Molho de tomate, muçarela, presunto de peru, parmesão, batata palha, tomate, pimentão, azeitona e orégano.'],
  ['Estrogonofe de Carne', 'Molho de tomate, muçarela, strogonoff de carne, champignon, azeitona, batata palha e orégano.', 15],
  ['Estrogonofe de Frango', 'Molho de tomate, muçarela, strogonoff de frango, champignon, azeitona, batata palha e orégano.'],
  ['Banana com canela', 'Muçarela, leite condensado, banana pacovã frita e canela.'],
  ['Chocolate', 'Muçarela, leite condensado, chocolate meio amargo e gotas de chocolate.'],
  ['Brigadeiro', 'Muçarela, chocolate meio amargo, granulado de chocolate e cerejas.'],
  ['Chocolate branco', 'Muçarela, leite condensado e chocolate branco.'],
  ['Prestígio', 'Muçarela, leite condensado, doce de coco, chocolate meio amargo e coco ralado.'],
  ['Sonho de valsa', 'Muçarela, leite condensado, chocolate meio amargo e bombom Sonho de Valsa triturado.'],
  ['Banana com chocolate', 'Muçarela, leite condensado, chocolate meio amargo e banana pacovã frita.'],
  ['Romeu e Julieta', 'Muçarela, leite condensado, goiabada e catupiry.'],
  ['Doce de leite', 'Muçarela, leite condensado, doce de leite e catupiry.'],
  ['MM’S', 'Muçarela, leite condensado, chocolate meio amargo e MM’S.'],
  ['Carne com cheddar', 'Molho de tomate, muçarela, carne desfiada, cheddar, azeitona e orégano.', 15],
  ['Pinguim 2', 'Molho de tomate, muçarela, frango, carne, tomate, cebola, pimentão, azeitona e orégano.', 15],
]

const lasagnaFlavorRows: FlavorRow[] = [
  ['Bolonhesa', 'Molho de tomate, massa de lasanha, presunto, carne moída, molho, queijo, azeitona e orégano.'],
  ['Queijo e Presunto', 'Molho de tomate, massa de lasanha, presunto, molho, queijo, azeitona e orégano.'],
  ['4 Queijos', 'Molho de tomate, massa de lasanha, muçarela, catupiry, queijo coalho, parmesão, molho, queijo, azeitona e orégano.'],
  ['Frango', 'Molho de tomate, massa de lasanha, frango, molho, queijo, azeitona e orégano.'],
  ['Carne Desfiada', 'Molho de tomate, massa de lasanha, carne desfiada, molho, queijo, azeitona e orégano.', 10],
  ['Carne com Cream Cheese', 'Molho de tomate, massa de lasanha, carne, cream cheese, molho, queijo, azeitona e orégano.', 10],
  ['Frango com Catupiry', 'Molho de tomate, massa de lasanha, frango, catupiry, molho, queijo, azeitona e orégano.', 10],
  ['Frango com Bacon', 'Molho de tomate, massa de lasanha, frango, bacon, molho, queijo, azeitona e orégano.', 10],
]

const juiceFlavors = ['Graviola', 'Acerola', 'Goiaba', 'Abacaxi', 'Taperebá', 'Maracujá', 'Cupuaçu', 'Caju']
const iceCreamFlavors = [
  'Amendoim',
  'Castanha do Pará',
  'Chocolate',
  'Leite Ninho com Nutella',
  'Caju',
  'Flocos',
  'Cupuaçu',
  'Cupuaçu Trufado',
  'Maracujá',
  'Milho verde',
  'Negresco',
  'Pavê de cupuaçu',
  'Tapioca',
  'Red Velvet',
  'Tucumã',
]

const pizzaSauces: ProductOptionSeed[] = [
  pricedOption('opt_pizza_sauce_mayo', 'Maionese', '1 sachê grande.', 2, 1),
  pricedOption('opt_pizza_sauce_ketchup', 'Ketchup', '1 sachê grande.', 2, 2),
  pricedOption('opt_pizza_sauce_bbq', 'Barbecue', '1 sachê grande.', 3, 3),
  pricedOption('opt_pizza_sauce_mustard', 'Mostarda', '1 sachê grande.', 2, 4),
  pricedOption('opt_pizza_sauce_rose', 'Rosé', '1 sachê grande.', 3, 5),
]

const burgerAddons: ProductOptionSeed[] = [
  pricedOption('opt_burger_addon_meat', 'Carne', undefined, 8, 1),
  pricedOption('opt_burger_addon_bacon', 'Bacon', undefined, 3, 2),
  pricedOption('opt_burger_addon_cheddar_cheese', 'Queijo cheddar', undefined, 3, 3),
  pricedOption('opt_burger_addon_cheddar_sauce', 'Molho cheddar', undefined, 3, 4),
  pricedOption('opt_burger_addon_catupiry', 'Catupiry', undefined, 3, 5),
  pricedOption('opt_burger_addon_house_sauce', 'Molho da casa', undefined, 2, 6),
  pricedOption('opt_burger_addon_caramelized_onion', 'Cebola caramelizada', undefined, 3, 7),
  pricedOption('opt_burger_addon_banana', 'Banana pacovã', undefined, 8, 8),
  pricedOption('opt_burger_addon_mozzarella', 'Muçarela', undefined, 3, 9),
  pricedOption('opt_burger_addon_turkey_ham', 'Presunto de peru', undefined, 2, 10),
  pricedOption('opt_burger_addon_egg', 'Ovo frito', undefined, 2, 11),
  pricedOption('opt_burger_addon_chicken', 'Frango grelhado', undefined, 6, 12),
]

const burgerSauces: ProductOptionSeed[] = [
  pricedOption('opt_burger_sauce_mayo', 'Maionese', '1 sachê grande.', 2, 1),
  pricedOption('opt_burger_sauce_ketchup', 'Ketchup', '1 sachê grande.', 2, 2),
  pricedOption('opt_burger_sauce_bbq', 'Barbecue', '1 sachê grande.', 3, 3),
  pricedOption('opt_burger_sauce_mustard', 'Mostarda', '1 sachê grande.', 2, 4),
  pricedOption('opt_burger_sauce_rose', 'Rosé', '1 sachê grande.', 3, 5),
]

const iceCreamSides = [
  'Amendoim colorido',
  'Amendoim granulado',
  'Calda de chocolate',
  'Calda de morango',
  'Canudinho recheado de chocolate',
  'Cascão',
  'Casquinha',
  'Cobertura de chocolate',
  'Cereja',
  'Chocoball',
  'Chocoball preto e branco',
  'Cobertura de morango',
  'Cobertura de maracujá',
  'Gotas de chocolate',
  'Granulado colorido',
  'Granulado de chocolate',
  'Jujuba',
  'Marshmallow',
  'MM’S',
]

const optionGroups: OptionGroupSeed[] = [
  group(
    'optgrp_pizza_flavors',
    'Sabores de pizza',
    'Sabores do cardápio atual. Adicionais de preço entram no item configurado.',
    1,
    pizzaFlavorRows.map(optionFromRow('opt_pizza_flavor')),
  ),
  group('optgrp_pizza_sauces', 'Molhos para pizzas', 'Escolha até 1 sachê grande.', 2, pizzaSauces),
  group(
    'optgrp_lasagna_flavors',
    'Sabores de lasanha',
    'Sabor obrigatório para todos os tamanhos de lasanha.',
    3,
    lasagnaFlavorRows.map(optionFromRow('opt_lasagna_flavor')),
  ),
  group(
    'optgrp_burger_addons',
    'Adicionais para burguers e sanduíches',
    'Escolha até 2 itens opcionais.',
    4,
    burgerAddons,
  ),
  group(
    'optgrp_burger_sauces',
    'Molhos para burguers e sanduíches',
    'Escolha até 1 sachê grande.',
    5,
    burgerSauces,
  ),
  group(
    'optgrp_juice_flavors',
    'Sabores de suco',
    'Sabor obrigatório para sucos.',
    6,
    juiceFlavors.map((name, index) => option(`opt_juice_flavor_${index + 1}`, name, undefined, index + 1)),
  ),
  group('optgrp_juice_milk', 'Adicional de suco', 'Leite opcional para o suco.', 7, [
    pricedOption('opt_juice_milk', 'Leite', undefined, 5, 1),
  ]),
  group('optgrp_juice_sugar', 'Açúcar do suco', 'Opção de preparo do suco.', 8, [
    option('opt_juice_no_sugar', 'Sem açúcar', undefined, 1),
  ]),
  group(
    'optgrp_icecream_flavors',
    'Sabores de sorvete',
    'Sabores disponíveis para sorvetes e milkshakes.',
    9,
    iceCreamFlavors.map((name, index) => option(`opt_icecream_flavor_${index + 1}`, name, undefined, index + 1)),
  ),
  group(
    'optgrp_icecream_sides',
    'Acompanhamentos do sorvete',
    'Escolha até 3 acompanhamentos.',
    10,
    iceCreamSides.map((name, index) => option(`opt_icecream_side_${index + 1}`, name, undefined, index + 1)),
  ),
  group('optgrp_fruit_salad_addons', 'Adicionais da salada de frutas', 'Adicionais opcionais.', 11, [
    pricedOption('opt_fruit_salad_lactea', 'Farinha Láctea', undefined, 2, 1),
    pricedOption('opt_fruit_salad_neston', 'Neston', undefined, 2, 2),
  ]),
]

const products: ProductSeed[] = [
  product('prod_duo', 'cat_combos', 'Combo X-Salada', 'X-Salada + batata pequena + refrigerante lata.', 29.9, images.combo, true, 'assembly', ['Combo']),
  product('prod_combo_pizza_sweet_savory', 'cat_combos', 'Pizza Salgada + Doce', '2 pizzas gigantes, 1 sabor cada pizza.', 120, images.pizza, true, 'pizza', ['Combo', 'Pizza'], [requiredGroup('optgrp_pizza_flavors', 1, 2, 1)]),
  product('prod_combo_pizza', 'cat_combos', 'Combo da Pizza', '2 pizzas tradicionais grandes.', 100, images.pizza, true, 'pizza', ['Combo', 'Pizza'], [requiredGroup('optgrp_pizza_flavors', 1, 2, 1)]),
  pizzaProduct('prod_pizza_small', 'Pizza Pequena', 'Até 2 sabores, 4 fatias.', 50, 2),
  pizzaProduct('prod_pizza_medium', 'Pizza Média', 'Até 2 sabores, 6 fatias.', 58, 2),
  pizzaProduct('prod_pizza_large', 'Pizza Grande', 'Até 2 sabores, 8 fatias.', 68, 2),
  pizzaProduct('prod_pizza_giant', 'Pizza Gigante', 'Até 3 sabores, 12 fatias.', 73, 3),
  product('prod_pizza_slice', 'cat_pizzas', 'Fatia', 'Fatia generosa de pizza.', 17, images.pizza, false, 'pizza', ['Pizza']),
  lasagnaProduct('prod_lasagna_small', 'Lasanha Pequena', 'Serve 1 pessoa.', 30),
  lasagnaProduct('prod_lasagna_medium', 'Lasanha Média', 'Serve até 2 pessoas.', 40),
  lasagnaProduct('prod_lasagna_large', 'Lasanha Grande', 'Serve até 3 pessoas.', 55),
  lasagnaProduct('prod_lasagna_family', 'Lasanha Família', 'Serve de 4 a 5 pessoas.', 65),
  product('prod_pinguim_bbq', 'cat_burgers', 'Pinguim BBQ', 'Pão brioche, 120g blend artesanal, cheddar, onion rings, bacon e barbecue.', 29.9, images.burger, true, 'chapa', ['Burguer'], burgerOptionLinks()),
  product('prod_prime', 'cat_burgers', 'Madeiro', 'Pão brioche, carne desfiada no molho madeira, muçarela, catupiry, bacon e cebola caramelizada.', 32, images.burger, true, 'chapa', ['Burguer'], burgerOptionLinks()),
  product('prod_smash', 'cat_burgers', 'Pinguim Tradicional', 'Pão brioche, 120g blend artesanal, cheddar e molho da casa.', 19.9, images.burger, false, 'chapa', ['Burguer'], burgerOptionLinks()),
  product('prod_pinguim_dobro', 'cat_burgers', 'Pinguim em Dobro', 'Pão brioche, dobro de carne artesanal e dobro de cheddar.', 29.9, images.burger, false, 'chapa', ['Burguer'], burgerOptionLinks()),
  product('prod_pinguim_melt', 'cat_burgers', 'Pinguim Melt', 'Pão brioche, blend artesanal, cheddar, bacon e cebola caramelizada.', 30.9, images.burger, true, 'chapa', ['Burguer'], burgerOptionLinks()),
  product('prod_primo_empanado', 'cat_burgers', 'Primo Empanado', 'Pão brioche, frango empanado, muçarela, alface, tomate e cream cheese.', 30, images.burger, false, 'chapa', ['Burguer', 'Frango'], burgerOptionLinks()),
  ...sandwichProducts(),
  product('prod_coke_15l', 'cat_beverages', 'Coca-Cola Original 1,5L', 'Refrigerante Coca-Cola Original 1,5L.', 12, images.drink, false, 'bar', ['Bebida']),
  product('prod_fanta_15l', 'cat_beverages', 'Fanta Laranja 1,5L', 'Refrigerante Fanta Laranja 1,5L.', 12, images.drink, false, 'bar', ['Bebida']),
  product('prod_coke_350', 'cat_beverages', 'Coca-Cola Original 350ml', 'Refrigerante Coca-Cola Original lata 350ml.', 6, images.drink, false, 'bar', ['Bebida']),
  product('prod_fanta_350', 'cat_beverages', 'Fanta Laranja Lata 350ml', 'Refrigerante Fanta Laranja lata 350ml.', 6, images.drink, false, 'bar', ['Bebida']),
  product('prod_bare_2l', 'cat_beverages', 'Baré 2L', 'Guaraná Baré 2L.', 8, images.drink, false, 'bar', ['Bebida']),
  product('prod_water_350', 'cat_beverages', 'Água 350ml', 'Água mineral 350ml.', 4, images.drink, false, 'bar', ['Bebida']),
  juiceProduct('prod_juice_1l', 'Suco de 1 litro', 25),
  juiceProduct('prod_juice_500', 'Suco de 500ml', 18),
  juiceProduct('prod_juice_300', 'Suco de 300ml', 12),
  iceCreamProduct('prod_icecream_1kg', 'Caixa Grande 1KG', 'Escolher de 1 a 6 sabores.', 73, 6),
  iceCreamProduct('prod_icecream_500', 'Caixa Média 500G', 'Escolher até 3 sabores.', 40, 3),
  iceCreamProduct('prod_icecream_250', 'Caixa Pequena 250G', 'Escolher até 2 sabores.', 20, 2),
  ...dessertProducts(),
  product('prod_soup_beef_vegetables', 'cat_soup', 'Carne com Legumes', 'Carne, batata, cenoura, jerimum, macarrão e ovo cozido.', 22, images.soup, false, 'kitchen', ['Sopa']),
  product('prod_fries_small', 'cat_starters', 'Batata Pequena', '120g de batata frita.', 12, images.fries, false, 'fritura', ['Entrada']),
  product('prod_fries', 'cat_starters', 'Batata Frita Média', '250g de batata frita.', 25, images.fries, false, 'fritura', ['Entrada']),
  product('prod_fries_large', 'cat_starters', 'Batata Frita Grande', '500g de batata frita.', 29, images.fries, false, 'fritura', ['Entrada']),
  product('prod_fries_cheddar_bacon', 'cat_starters', 'Batata com Cheddar e Bacon', '300g com cheddar e bacon.', 32, images.fries, false, 'fritura', ['Entrada']),
  product('prod_fries_beef_gratin', 'cat_starters', 'Batata com Carne e Queijo Gratinado', '300g com carne desfiada e muçarela.', 36.9, images.fries, false, 'fritura', ['Entrada']),
  ...standaloneSauceProducts(),
  ...standaloneAddonProducts(),
]

export async function seedCatalog(
  prisma: PrismaClient,
  storeId: string,
  channels: readonly ProductChannel[],
) {
  for (const entry of categories) {
    await prisma.category.upsert({
      where: { id: entry.id },
      update: {
        name: entry.name,
        description: entry.description,
        sortOrder: entry.sortOrder,
      },
      create: {
        ...entry,
        storeId,
      },
    })
  }

  for (const entry of optionGroups) {
    await prisma.productOptionGroup.upsert({
      where: { id: entry.id },
      update: {
        name: entry.name,
        description: entry.description,
        sortOrder: entry.sortOrder,
      },
      create: {
        id: entry.id,
        storeId,
        name: entry.name,
        description: entry.description,
        sortOrder: entry.sortOrder,
      },
    })

    for (const optionEntry of entry.options) {
      await prisma.productOption.upsert({
        where: { id: optionEntry.id },
        update: {
          name: optionEntry.name,
          description: optionEntry.description,
          image: optionEntry.image,
          priceDelta: optionEntry.priceDelta ?? 0,
          active: true,
          available: optionEntry.available ?? true,
          soldOut: optionEntry.soldOut ?? false,
          sortOrder: optionEntry.sortOrder,
        },
        create: {
          id: optionEntry.id,
          groupId: entry.id,
          name: optionEntry.name,
          description: optionEntry.description,
          image: optionEntry.image,
          priceDelta: optionEntry.priceDelta ?? 0,
          active: true,
          available: optionEntry.available ?? true,
          soldOut: optionEntry.soldOut ?? false,
          sortOrder: optionEntry.sortOrder,
        },
      })
    }
  }

  for (const entry of products) {
    await prisma.product.upsert({
      where: { id: entry.id },
      update: {
        categoryId: entry.categoryId,
        name: entry.name,
        description: entry.description,
        price: entry.price,
        image: entry.image,
        featured: entry.featured,
        active: true,
        preparationStation: entry.preparationStation,
        tags: entry.tags,
      },
      create: {
        id: entry.id,
        storeId,
        categoryId: entry.categoryId,
        name: entry.name,
        description: entry.description,
        price: entry.price,
        image: entry.image,
        featured: entry.featured,
        active: true,
        preparationStation: entry.preparationStation,
        tags: entry.tags,
      },
    })

    for (const channel of entry.channels ?? channels) {
      await prisma.productChannelAvailability.upsert({
        where: {
          productId_channel: {
            productId: entry.id,
            channel,
          },
        },
        update: {
          available: true,
          visible: true,
          soldOut: false,
        },
        create: {
          productId: entry.id,
          channel,
          available: true,
          visible: true,
          soldOut: false,
        },
      })
    }

    for (const link of entry.optionGroups ?? []) {
      await prisma.productOptionGroupLink.upsert({
        where: {
          productId_groupId: {
            productId: entry.id,
            groupId: link.groupId,
          },
        },
        update: {
          required: link.required,
          minSelections: link.minSelections,
          maxSelections: link.maxSelections,
          sortOrder: link.sortOrder,
          description: link.description,
          autoApplied: false,
        },
        create: {
          productId: entry.id,
          groupId: link.groupId,
          required: link.required,
          minSelections: link.minSelections,
          maxSelections: link.maxSelections,
          sortOrder: link.sortOrder,
          description: link.description,
          autoApplied: false,
        },
      })
    }
  }

  const categoryGroupLinks = new Map<string, ProductOptionGroupLinkSeed & {
    categoryId: string
  }>()

  for (const entry of products) {
    for (const link of entry.optionGroups ?? []) {
      const key = `${entry.categoryId}:${link.groupId}`
      if (!categoryGroupLinks.has(key)) {
        categoryGroupLinks.set(key, {
          ...link,
          categoryId: entry.categoryId,
        })
      }
    }
  }

  for (const link of categoryGroupLinks.values()) {
    await prisma.productOptionGroupCategoryLink.upsert({
      where: {
        categoryId_groupId: {
          categoryId: link.categoryId,
          groupId: link.groupId,
        },
      },
      update: {
        required: link.required,
        minSelections: link.minSelections,
        maxSelections: link.maxSelections,
        sortOrder: link.sortOrder,
        description: link.description,
        autoApply: true,
      },
      create: {
        categoryId: link.categoryId,
        groupId: link.groupId,
        required: link.required,
        minSelections: link.minSelections,
        maxSelections: link.maxSelections,
        sortOrder: link.sortOrder,
        description: link.description,
        autoApply: true,
      },
    })
  }
}

function category(id: string, name: string, description: string, sortOrder: number): CatalogCategorySeed {
  return {
    id,
    name,
    description,
    sortOrder,
  }
}

function group(
  id: string,
  name: string,
  description: string,
  sortOrder: number,
  options: ProductOptionSeed[],
): OptionGroupSeed {
  return {
    id,
    name,
    description,
    sortOrder,
    options,
  }
}

function option(
  id: string,
  name: string,
  description: string | undefined,
  sortOrder: number,
): ProductOptionSeed {
  return {
    id,
    name,
    description,
    sortOrder,
  }
}

function pricedOption(
  id: string,
  name: string,
  description: string | undefined,
  priceDelta: number,
  sortOrder: number,
): ProductOptionSeed {
  return {
    id,
    name,
    description,
    priceDelta,
    sortOrder,
  }
}

function optionFromRow(prefix: string) {
  return ([name, description, priceDelta]: FlavorRow, index: number): ProductOptionSeed => ({
    id: `${prefix}_${index + 1}`,
    name,
    description,
    priceDelta: priceDelta ?? 0,
    sortOrder: index + 1,
  })
}

function requiredGroup(
  groupId: string,
  minSelections: number,
  maxSelections: number,
  sortOrder: number,
  description?: string,
): ProductOptionGroupLinkSeed {
  return {
    groupId,
    required: true,
    minSelections,
    maxSelections,
    sortOrder,
    description,
  }
}

function optionalGroup(
  groupId: string,
  maxSelections: number,
  sortOrder: number,
  description?: string,
): ProductOptionGroupLinkSeed {
  return {
    groupId,
    required: false,
    minSelections: 0,
    maxSelections,
    sortOrder,
    description,
  }
}

function product(
  id: string,
  categoryId: string,
  name: string,
  description: string,
  price: number,
  image: string,
  featured: boolean,
  preparationStation: string,
  tags: string[],
  optionGroups?: ProductOptionGroupLinkSeed[],
): ProductSeed {
  return {
    id,
    categoryId,
    name,
    description,
    price,
    image,
    featured,
    preparationStation,
    tags,
    optionGroups,
  }
}

function pizzaProduct(
  id: string,
  name: string,
  description: string,
  price: number,
  maxFlavors: number,
): ProductSeed {
  return product(id, 'cat_pizzas', name, description, price, images.pizza, true, 'pizza', ['Pizza'], [
    requiredGroup('optgrp_pizza_flavors', 1, maxFlavors, 1, `Escolha de 1 a ${maxFlavors} sabores.`),
    optionalGroup('optgrp_pizza_sauces', 1, 2, 'Molho opcional.'),
  ])
}

function lasagnaProduct(id: string, name: string, description: string, price: number): ProductSeed {
  return product(id, 'cat_lasanhas', name, description, price, images.lasagna, false, 'kitchen', ['Lasanha'], [
    requiredGroup('optgrp_lasagna_flavors', 1, 1, 1, 'Escolha 1 sabor.'),
  ])
}

function burgerOptionLinks(): ProductOptionGroupLinkSeed[] {
  return [
    optionalGroup('optgrp_burger_addons', 2, 1, 'Adicionais opcionais.'),
    optionalGroup('optgrp_burger_sauces', 1, 2, 'Molho opcional.'),
  ]
}

function sandwichProducts(): ProductSeed[] {
  const rows: SimpleProductRow[] = [
    ['prod_x_frango', 'X-filé de frango', 'Filé de frango, muçarela, presunto, ovo, tomate e alface.', 25],
    ['prod_x_banana', 'X-banana', 'Muçarela, presunto, hambúrguer artesanal, ovo, banana, alface e tomate.', 26],
    ['prod_x_burguer', 'X-burguer', 'Hambúrguer artesanal, queijo, alface e tomate.', 15],
    ['prod_misto_duplo', 'Misto duplo', 'Pão de forma com 3 fatias, queijo e presunto.', 17],
    ['prod_x_calabresa', 'X-calabresa', 'Hambúrguer caseiro, queijo, calabresa, alface e tomate.', 29],
    ['prod_x_salada', 'X-salada', 'Hambúrguer, muçarela, presunto, ovo, tomate e alface.', 19],
    ['prod_misto', 'Misto', 'Pão de forma com 2 fatias, queijo e presunto.', 12],
    ['prod_x_caboquinho', 'X-caboquinho', 'Queijo coalho, presunto, tucumã, banana frita, ovo, alface e tomate.', 31],
    ['prod_x_salada_bacon', 'X-salada bacon', 'Muçarela, presunto, hambúrguer, ovo, bacon, alface e tomate.', 27],
    ['prod_x_salsicha', 'X-salsicha', 'Hambúrguer artesanal, queijo, salsicha, presunto, ovo, alface e tomate.', 24],
    ['prod_x_tudo', 'X-tudo', 'Muçarela, presunto, hambúrguer artesanal, calabresa, ovo, bacon, salsicha, alface e tomate.', 33],
    ['prod_x_salada_special', 'X-Salada Especial', '2 carnes artesanais de 100g, muçarela, presunto de peru, ovo, alface e tomate.', 22],
    ['prod_x_maionese', 'X-Maionese', 'Carne artesanal, muçarela, molho maionese, alface e tomate.', 18],
    ['prod_x_salada_pinguim', 'X-Salada Pinguim', 'Hambúrguer, muçarela, presunto, ovo, tomate, alface e cebola caramelizada.', 20],
    ['prod_burger_kids', 'Burguer Kids', 'Pão brioche, carne artesanal, cheddar, batata pequena e molho rosé.', 25],
  ]

  return rows.map(([id, name, description, price]) =>
    product(id, 'cat_sandwiches', name, description, price, images.sandwich, false, 'chapa', ['Sanduíche'], burgerOptionLinks()),
  )
}

function juiceProduct(id: string, name: string, price: number): ProductSeed {
  return product(id, 'cat_juices', name, 'Suco com 1 sabor obrigatório, leite opcional e opção sem açúcar.', price, images.juice, false, 'bar', ['Suco'], [
    requiredGroup('optgrp_juice_flavors', 1, 1, 1, 'Escolha o sabor do suco.'),
    optionalGroup('optgrp_juice_milk', 1, 2, 'Leite opcional.'),
    optionalGroup('optgrp_juice_sugar', 1, 3, 'Preparo sem açúcar.'),
  ])
}

function iceCreamProduct(
  id: string,
  name: string,
  description: string,
  price: number,
  maxFlavors: number,
): ProductSeed {
  return product(id, 'cat_ice_creams', name, description, price, images.iceCream, false, 'dessert', ['Sorvete'], [
    requiredGroup('optgrp_icecream_flavors', 1, maxFlavors, 1, `Escolha de 1 a ${maxFlavors} sabores.`),
    optionalGroup('optgrp_icecream_sides', 3, 2, 'Acompanhamentos opcionais.'),
  ])
}

function dessertProducts(): ProductSeed[] {
  const rows: SimpleProductRow[] = [
    ['prod_fruit_lactea', 'Adicional Farinha Láctea', 'Adicional para sobremesas e salada de frutas.', 2],
    ['prod_fruit_neston', 'Adicional Neston', 'Adicional para sobremesas e salada de frutas.', 2],
    ['prod_banana_split', 'Banana Split', 'Banana, sorvete, calda, cereja e chantilly.', 29.9],
    ['prod_petit_gateau', 'Petit Gateau', 'Bolinho de chocolate, calda e sorvete.', 29],
    ['prod_fruit_salad_500', 'Salada de Fruta 500ml', 'Leite condensado, creme de leite e frutas.', 22],
    ['prod_fruit_salad_icecream_500', 'Salada de Frutas com Sorvete 500ml', 'Salada de frutas, sorvete e chantilly.', 29],
    ['prod_fruit_salad_icecream_300', 'Salada de Frutas com Sorvete 300ml', 'Frutas, sorvete e chantilly.', 26],
    ['prod_fruit_salad_180', 'Salada de Frutas 180ml', 'Salada de frutas.', 10],
    ['prod_fruit_salad_300', 'Salada de Frutas 300ml', 'Salada de frutas.', 17],
    ['prod_waffle_icecream', 'Waffle com Sorvete', 'Waffle, sorvete, calda, chantilly e chocolate.', 22],
  ]
  const productsFromRows = rows.map(([id, name, description, price]) => {
    const optionGroups = name.includes('Salada de Fruta')
      ? [optionalGroup('optgrp_fruit_salad_addons', 2, 1, 'Adicionais opcionais.')]
      : undefined

    return product(id, 'cat_desserts', name, description, price, images.dessert, false, 'dessert', ['Sobremesa'], optionGroups)
  })

  return [
    ...productsFromRows,
    milkshakeProduct('prod_milkshake_300', 'Milkshake 300ml', 'Sorvete com calda e chantilly opcional.', 22),
    milkshakeProduct('prod_milkshake_500', 'Milkshake 500ml', 'Sorvete no sabor escolhido, conforme disponibilidade.', 28),
  ]
}

function milkshakeProduct(id: string, name: string, description: string, price: number): ProductSeed {
  return product(id, 'cat_desserts', name, description, price, images.iceCream, false, 'dessert', ['Milkshake'], [
    requiredGroup('optgrp_icecream_flavors', 1, 1, 1, 'Escolha o sabor do milkshake.'),
    optionalGroup('optgrp_icecream_sides', 2, 2, 'Calda e chantilly opcionais.'),
  ])
}

function standaloneSauceProducts(): ProductSeed[] {
  return pizzaSauces.map((entry) =>
    product(
      `prod_${entry.id.replace('opt_pizza_', '')}`,
      'cat_sauces',
      entry.name,
      entry.description ?? 'Molho avulso.',
      entry.priceDelta ?? 0,
      images.sauce,
      false,
      'assembly',
      ['Molho'],
    ),
  )
}

function standaloneAddonProducts(): ProductSeed[] {
  const dessertAddons: ProductOptionSeed[] = [
    pricedOption('opt_standalone_lactea', 'Adicional Farinha Láctea', undefined, 2, 1),
    pricedOption('opt_standalone_neston', 'Adicional Neston', undefined, 2, 2),
  ]
  const entries = [...burgerAddons, ...dessertAddons]

  return entries.map((entry) =>
    product(
      `prod_${entry.id.replace('opt_', '')}`,
      'cat_addons',
      entry.name,
      entry.description ?? 'Adicional avulso.',
      entry.priceDelta ?? 0,
      images.sauce,
      false,
      'assembly',
      ['Adicional'],
    ),
  )
}
