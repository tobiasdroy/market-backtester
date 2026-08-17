/** Converts an array of flat records to a CSV string. Values containing
 * a comma, quote, or newline are quoted and internal quotes escaped,
 * per RFC 4180 - good enough for the numbers/dates/booleans this app
 * exports, without pulling in a CSV library for it. */
export function toCsv(rows: Record<string, string | number | boolean>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])

  function escapeCell(value: string | number | boolean): string {
    const str = String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ]
  return lines.join('\n')
}

/** Triggers a browser download of `content` as a file named `filename`. */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
