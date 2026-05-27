export type JsonValue = string | null | undefined

export function parseJson<T>(value: JsonValue): T | undefined {
  if (value == null || value === '') return undefined
  return JSON.parse(value) as T
}

export function boolToInt(value: boolean | undefined): number {
  return value ? 1 : 0
}

export function clone<T>(value: T): T {
  return structuredClone(value)
}
