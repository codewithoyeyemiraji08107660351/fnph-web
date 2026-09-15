export function passwordProblems(password: string, confirm: string, min: number, identity: string[] = []): string | null {
  if (password.length < min) return `Use at least ${min} characters.`
  const lower = password.toLowerCase()
  if (identity.some((part) => part && part.length >= 3 && lower.includes(part.toLowerCase()))) return 'Do not use your name, username or email in your password.'
  if (password !== confirm) return 'The two passwords do not match.'
  return null
}
