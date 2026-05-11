import type { Customer } from '@/types'

export const customersMock: Customer[] = [
  {
    id: 'cus_1',
    name: 'Marina Teixeira',
    phone: '(92) 99111-2201',
    tags: ['Recorrente', 'VIP'],
    addresses: [
      {
        id: 'addr_1',
        label: 'Casa',
        street: 'Rua das Acácias',
        number: '174',
        district: 'Adrianópolis',
        city: 'Manaus',
        state: 'AM',
        reference: 'Perto da praça',
      },
    ],
  },
  {
    id: 'cus_2',
    name: 'Carlos Menezes',
    phone: '(92) 98800-1220',
    tags: ['Delivery'],
    addresses: [
      {
        id: 'addr_2',
        label: 'Apartamento',
        street: 'Av. João Valério',
        number: '1220',
        district: 'Nossa Senhora das Graças',
        city: 'Manaus',
        state: 'AM',
      },
    ],
  },
  {
    id: 'cus_3',
    name: 'Patrícia Nunes',
    phone: '(92) 99212-5510',
    tags: ['Salão'],
    addresses: [],
  },
  {
    id: 'cus_4',
    name: 'Lucas Prado',
    phone: '(92) 99541-4100',
    tags: ['WhatsApp'],
    addresses: [
      {
        id: 'addr_4',
        label: 'Escritório',
        street: 'Rua Salvador',
        number: '550',
        district: 'Vieiralves',
        city: 'Manaus',
        state: 'AM',
      },
    ],
  },
]
