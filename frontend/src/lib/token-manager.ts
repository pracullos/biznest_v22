const ACCESS_TOKEN_KEY = 'biznest:access_token'

export const tokenManager = {
  get: (): string | null => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  set: (token: string): void => { sessionStorage.setItem(ACCESS_TOKEN_KEY, token) },
  clear: (): void => { sessionStorage.removeItem(ACCESS_TOKEN_KEY) },
}
