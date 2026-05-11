import type { AppUser } from '@/types'

export const usersMock: AppUser[] = [
  { id: 'usr_1', name: 'Henrique Araújo', role: 'owner', initials: 'HA', online: true },
  { id: 'usr_2', name: 'Bruna Mota', role: 'manager', initials: 'BM', online: true },
  { id: 'usr_3', name: 'Lia Costa', role: 'attendant', initials: 'LC', online: true },
  { id: 'usr_4', name: 'Raul Souza', role: 'cashier', initials: 'RS', online: true },
  { id: 'usr_5', name: 'Caio Lima', role: 'kitchen', initials: 'CL', online: true },
  { id: 'usr_6', name: 'Diego Paz', role: 'driver', initials: 'DP', online: true },
  { id: 'usr_7', name: 'Sara Vale', role: 'supervisor', initials: 'SV', online: false },
]
