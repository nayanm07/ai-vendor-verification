/** Material Symbols icon (font loaded in index.html). */
export function Icon({ name, size }: { name: string; size?: number }) {
  return (
    <span className="icon" aria-hidden="true" style={size ? { fontSize: size } : undefined}>
      {name}
    </span>
  )
}
