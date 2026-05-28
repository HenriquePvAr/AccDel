import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

interface TabsContextValue {
  baseId: string
  value: string
  setValue: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: ReactNode
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const reactId = useId()
  const baseId = `tabs-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [internalValue, setInternalValue] = useState(defaultValue ?? value ?? '')
  const selectedValue = value ?? internalValue

  const contextValue = useMemo<TabsContextValue>(
    () => ({
      baseId,
      value: selectedValue,
      setValue: (nextValue) => {
        if (value === undefined) {
          setInternalValue(nextValue)
        }
        onValueChange?.(nextValue)
      },
    }),
    [baseId, onValueChange, selectedValue, value],
  )

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 overflow-x-auto rounded-[22px] border border-white/10 bg-[#07111f]/82 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] scrollbar-thin',
        className,
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({
  value,
  className,
  children,
  onClick,
  ...props
}: TabsTriggerProps) {
  const context = useTabsContext('TabsTrigger')
  const active = context.value === value

  return (
    <button
      type="button"
      role="tab"
      id={`${context.baseId}-trigger-${value}`}
      aria-selected={active}
      aria-controls={`${context.baseId}-content-${value}`}
      data-state={active ? 'active' : 'inactive'}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[18px] px-3.5 py-2 text-sm font-black tracking-[-0.01em] text-slate-400 transition-[background-color,color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040b15] data-[state=active]:bg-[linear-gradient(180deg,rgba(234,109,44,0.98),rgba(189,73,19,0.98))] data-[state=active]:text-white data-[state=active]:shadow-[0_12px_28px_rgba(198,93,46,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]',
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          context.setValue(value)
        }
      }}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  forceMount?: boolean
}

export function TabsContent({
  value,
  forceMount,
  className,
  ...props
}: TabsContentProps) {
  const context = useTabsContext('TabsContent')
  const active = context.value === value

  if (!active && !forceMount) {
    return null
  }

  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-content-${value}`}
      aria-labelledby={`${context.baseId}-trigger-${value}`}
      hidden={!active}
      className={cn('outline-none', className)}
      {...props}
    />
  )
}

function useTabsContext(componentName: string) {
  const context = useContext(TabsContext)

  if (!context) {
    throw new Error(`${componentName} must be used inside Tabs.`)
  }

  return context
}
