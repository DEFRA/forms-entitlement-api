/**
 * @typedef {{userId: string, email?: string, displayName?: string, roles: string[], scopes: string[]}} UserEntitlementDocument
 * @typedef {{ userId: string }} UserById
 * @typedef {{ email: string, roles: string[] }} UserEntitlementCreateRequest
 * @typedef {{ roles: string[] }} UserEntitlementUpdateRequest
 * @typedef {Request<{ Server: { db: Db }, Payload: UserEntitlementCreateRequest }>} CreateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById, Payload: UserEntitlementUpdateRequest }>} UpdateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById }>} DeleteUserRequest
 */

/**
 * Migration-related types
 * @typedef {object} MigrationResult
 * @property {string} status - Migration status
 * @property {object} summary - Migration summary
 * @property {number} summary.total - Total users processed
 * @property {number} summary.successful - Successfully migrated users
 * @property {number} summary.failed - Failed migration users
 * @property {number} summary.skipped - Skipped users
 * @property {object} results - Detailed results
 * @property {MigratedUser[]} results.successful - Successfully migrated users
 * @property {FailedUser[]} results.failed - Failed migration users
 * @property {FailedUser[]} results.skipped - Skipped users
 */

/**
 * @typedef {object} MigratedUser
 * @property {string} userId - Azure AD user ID
 * @property {string} displayName - User display name
 * @property {string} email - User email
 * @property {string[]} roles - Assigned roles
 * @property {string[]} scopes - Assigned scopes
 */

/**
 * @typedef {object} FailedUser
 * @property {string} userId - Azure AD user ID
 * @property {string} displayName - User display name
 * @property {string} email - User email
 * @property {string} error - Error message or reason for failure/skip
 */

/**
 * @import { Request } from '@hapi/hapi'
 * @import { Db } from 'mongodb'
 */
