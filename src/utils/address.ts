export function formatAddress(resident: { apt?: string; building?: string; address?: string }): string {
  if (!resident) return ''
  const parts = []
  if (resident.apt) parts.push(resident.apt)
  if (resident.building) parts.push(resident.building)
  if (resident.address) parts.push(resident.address)
  return parts.join(' ')
}
