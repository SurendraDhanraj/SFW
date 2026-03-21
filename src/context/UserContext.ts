import { createContext, useContext } from 'react'

export type AppUser = {
  _id: string
  name: string
  email: string
  roleId: string
  role: { _id: string; name: string; permissions: string[] } | null
}

export const UserContext = createContext<AppUser | null>(null)

export function useUser(): AppUser {
  const user = useContext(UserContext)
  if (!user) throw new Error('useUser must be used within UserContext.Provider')
  return user
}

/** Check if user has a given permission */
export function useHasPermission(permission: string): boolean {
  const user = useUser()
  const perms = user.role?.permissions ?? []
  return perms.includes('all') || perms.includes(permission)
}

/** Check if user is director or supervisor */
export function useIsSuperiorRole(): boolean {
  const user = useUser()
  const roleName = user.role?.name ?? ''
  return roleName === 'Director' || roleName === 'Supervisor'
}
