import { useEffect, useState, type InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
}

/** A numeric input that can be freely cleared while editing, instead of
 * a plain `<input type="number" value={n} onChange={...Number(...)}>`
 * snapping straight back to "0" the moment the field is emptied (which
 * traps the cursor behind that 0 and forces typing e.g. "05000" to get
 * "5000"). Keeps its own text while the value being typed doesn't yet
 * parse to a number (empty, "-", "12.", ...) and only calls `onChange`
 * once it does; reverts to the last valid value on blur if left empty
 * or invalid. */
export function NumberInput({ value, onChange, onBlur, ...rest }: NumberInputProps) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <input
      {...rest}
      type="number"
      value={text}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        const parsed = Number(next)
        if (next.trim() !== '' && !Number.isNaN(parsed)) {
          onChange(parsed)
        }
      }}
      onBlur={(e) => {
        if (text.trim() === '' || Number.isNaN(Number(text))) {
          setText(String(value))
        }
        onBlur?.(e)
      }}
    />
  )
}
