import { Store } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { queryClient } from '@/hooks/queries'
import {
  getApiStoreId,
  setApiStoreId,
} from '@/services/http/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { StoreProfile } from '@/types'

type StoreSelectorOption = Pick<StoreProfile, 'id' | 'name' | 'tradeName'>

const defaultStoreOption: StoreSelectorOption = {
  id: 'store_main',
  name: 'Cain Delivery',
  tradeName: 'Cain Delivery',
}

export function StoreSelector() {
  const sessionStore = useAuthStore((state) => state.user?.store)
  const options = useMemo(() => buildStoreOptions(sessionStore), [sessionStore])
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(() => getApiStoreId())
  const effectiveStoreId = selectedStoreId ?? sessionStore?.id ?? defaultStoreOption.id

  const selectedStore =
    options.find((option) => option.id === effectiveStoreId) ??
    options[0] ??
    defaultStoreOption

  return (
    <div className="flex max-w-full items-center gap-2">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Store className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Loja ativa
        </p>
        <Select value={selectedStore.id} onValueChange={handleStoreChange}>
          <SelectTrigger className="h-5 min-w-[132px] border-0 bg-transparent px-0 py-0 text-sm font-semibold text-foreground shadow-none focus:ring-0 sm:min-w-[150px]">
            <SelectValue aria-label={selectedStore.tradeName}>
              {selectedStore.tradeName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.tradeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId)
    setApiStoreId(storeId)
    void queryClient.invalidateQueries()
  }
}

function buildStoreOptions(sessionStore?: StoreSelectorOption | null) {
  const options = new Map<string, StoreSelectorOption>()
  const storedStoreId = getApiStoreId()

  if (sessionStore) {
    options.set(sessionStore.id, sessionStore)
  }

  options.set(defaultStoreOption.id, defaultStoreOption)

  if (storedStoreId && !options.has(storedStoreId)) {
    options.set(storedStoreId, {
      id: storedStoreId,
      name: storedStoreId,
      tradeName: storedStoreId,
    })
  }

  return [...options.values()]
}
