/**
 * Bundles all tenant-scoped repositories (excludes UserRepository which is not tenant-scoped).
 */
export { UserRepository } from './UserRepository.js'
export type { UserRecord } from './UserRepository.js'
