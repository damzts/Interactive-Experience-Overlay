import { apiFetch } from './client.js'

export interface ObsTestResult {
  connected: boolean
  message?: string
}

export async function testObsConnection(): Promise<ObsTestResult> {
  return apiFetch<ObsTestResult>('/api/obs/test')
}
