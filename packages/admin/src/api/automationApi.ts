import type { AutomationRule } from '@ieomlabs/shared'
import { apiFetch } from './client.js'

export async function fetchAutomationRules(): Promise<AutomationRule[]> {
  return apiFetch<AutomationRule[]>('/api/automation/rules')
}

export async function createAutomationRule(rule: Omit<AutomationRule, 'id'>): Promise<AutomationRule> {
  return apiFetch<AutomationRule>('/api/automation/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  })
}

export async function patchAutomationRule(id: string, patch: Partial<Omit<AutomationRule, 'id'>>): Promise<AutomationRule> {
  return apiFetch<AutomationRule>(`/api/automation/rules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export async function deleteAutomationRule(id: string): Promise<void> {
  await apiFetch(`/api/automation/rules/${id}`, { method: 'DELETE' })
}
