function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function fuzzyMatch(
  query: string,
  candidates: string[],
  threshold = 0.6
): string[] {
  const q = query.toLowerCase()
  return candidates.filter((c) => {
    const t = c.toLowerCase()
    const dist = levenshtein(q, t)
    const maxLen = Math.max(q.length, t.length)
    const similarity = 1 - dist / maxLen
    return similarity >= threshold || t.includes(q)
  })
}
