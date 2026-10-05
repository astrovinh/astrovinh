/** A typed name without the quotes or < > people copy from the examples; only the ends are touched. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/^[<"']+|[>"']+$/g, '').trim()
}
