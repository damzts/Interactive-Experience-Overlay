/**
 * Property 1: Localhost-Only Binding
 *
 * For any connection attempt from a non-localhost IP address, the Embedded Server
 * SHALL reject the connection and not serve any response.
 *
 * This is a static analysis property test — verifying the code structure
 * guarantees the server only binds to 127.0.0.1 and never to 0.0.0.0 or
 * any other network interface.
 *
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fc from 'fast-check'

const __dirname = dirname(fileURLToPath(import.meta.url))
const desktopEntryPath = join(__dirname, '..', '..', 'desktop-entry.ts')

let desktopEntrySource: string

beforeAll(() => {
  desktopEntrySource = readFileSync(desktopEntryPath, 'utf-8')
})

describe('Property 1: Localhost-Only Binding', () => {
  describe('Static analysis: server binds to 127.0.0.1', () => {
    it('the source contains host: 127.0.0.1 in the listen configuration', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // The server MUST bind to localhost only
            expect(desktopEntrySource).toMatch(/host:\s*['"]127\.0\.0\.1['"]/)
          }
        ),
        { numRuns: 1 }
      )
    })
  })

  describe('Static analysis: server does NOT bind to 0.0.0.0', () => {
    it('the source does not contain host: 0.0.0.0 (all interfaces)', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // The server MUST NOT bind to all interfaces
            expect(desktopEntrySource).not.toMatch(/host:\s*['"]0\.0\.0\.0['"]/)
          }
        ),
        { numRuns: 1 }
      )
    })
  })

  describe('Static analysis: no non-localhost IPs appear as bind addresses', () => {
    it('for any generated non-localhost IP, it does not appear as a host binding in the source', () => {
      // Generator for non-localhost IPs (private and public ranges)
      const nonLocalhostIp = fc.oneof(
        // 10.x.x.x (private class A)
        fc.tuple(
          fc.constant(10),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        // 172.16-31.x.x (private class B)
        fc.tuple(
          fc.constant(172),
          fc.integer({ min: 16, max: 31 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        // 192.168.x.x (private class C)
        fc.tuple(
          fc.constant(192),
          fc.constant(168),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        // Public IPs (1-9, 11-126, 128-191 first octet, excluding 127.x.x.x)
        fc.tuple(
          fc.oneof(
            fc.integer({ min: 1, max: 9 }),
            fc.integer({ min: 11, max: 126 }),
            fc.integer({ min: 128, max: 223 })
          ),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)
      )

      fc.assert(
        fc.property(
          nonLocalhostIp,
          (ip: string) => {
            // Escape dots for regex matching
            const escapedIp = ip.replace(/\./g, '\\.')
            // The non-localhost IP must NOT appear as a host binding in the source
            const hostBindingPattern = new RegExp(`host:\\s*['"]${escapedIp}['"]`)
            expect(desktopEntrySource).not.toMatch(hostBindingPattern)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Static analysis: listen call uses localhost', () => {
    it('the app.listen call specifies 127.0.0.1 as the host parameter', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // Verify the listen call pattern includes the localhost host
            expect(desktopEntrySource).toMatch(/app\.listen\s*\(\s*\{[^}]*host:\s*['"]127\.0\.0\.1['"]/)
          }
        ),
        { numRuns: 1 }
      )
    })
  })
})
