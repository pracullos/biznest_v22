import Axios from 'axios'

const ACCESS_TOKEN_KEY = 'biznest:access_token'

export const tokenManager = {
  get: (): string | null => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  set: (token: string): void => { sessionStorage.setItem(ACCESS_TOKEN_KEY, token) },
  clear: (): void => { sessionStorage.removeItem(ACCESS_TOKEN_KEY) },
}

Axios.defaults.baseURL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
Axios.defaults.withCredentials = true
Axios.defaults.headers.common['Accept'] = 'application/json'

Axios.interceptors.request.use(
  (config) => {
    const token = tokenManager.get()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

Axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const detail = error.response?.data?.detail

    if (status === 403) {
      console.error('Access denied:', detail ?? 'You do not have permission to access this resource.')
    }

    if (!error.response && !Axios.isCancel(error) && error.code !== 'ERR_CANCELED') {
      console.error('Network error: server unreachable or returned no response.')
    }

    // 401 is handled by AuthProvider — do not intercept here
    return Promise.reject(error)
  }
)