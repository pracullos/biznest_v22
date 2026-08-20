export interface JwtPayload {
  sub: string
  email: string
  city_id?: string
  iat: number
  exp: number
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const b64 = token.split('.')[1]
    return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload
  } catch {
    return null
  }
}