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
        'flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 scrollbar-thin',
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
        'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-white/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm',
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
