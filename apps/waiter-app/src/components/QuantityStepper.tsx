import { Minus, Plus } from 'lucide-react'

export function QuantityStepper({
  value,
  min = 1,
  max = 20,
  onChange,
  label = 'Quantidade',
}: {
  value: number
  min?: number
  max?: number
  onChange(value: number): void
  label?: string
}) {
  return (
    <div className="quantity-stepper" aria-label={label}>
      <button type="button" aria-label="Diminuir quantidade" disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={18} /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Aumentar quantidade" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={18} /></button>
    </div>
  )
}
