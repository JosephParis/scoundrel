// Format a parts array (from describe* helpers) as a math expression.
// e.g. [{value:8, label:'monster', op:'+'}, {value:3, label:'weapon', op:'-'}]
//   → "8 − 3 weapon"
export function formatFormula(parts) {
  if (!parts || parts.length === 0) return ''
  if (parts.length === 1) return `${parts[0].value} ${parts[0].label}`
  return parts.map((p, i) => {
    if (i === 0) return `${p.value}`
    const sign = p.op === '-' ? '−' : '+'
    return ` ${sign} ${p.value} ${p.label}`
  }).join('')
}
