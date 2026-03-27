/**
 * User as stored in MongoDB — scopes are not stored, they are computed at read-time
 * @typedef {Omit<EntitlementUser, 'scopes'>} StoredUser
 */

/**
 * @typedef {{ userId: string }} UserById
 * @typedef {{ email: string, roles: Roles[] }} UserEntitlementCreateRequest
 * @typedef {{ roles: Roles[] }} UserEntitlementUpdateRequest
 * @typedef {AuditUser & { roles: Roles[] }} CallingUser
 * @typedef {Request<{ Server: { db: Db }, Payload: UserEntitlementCreateRequest }>} CreateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById, Payload: UserEntitlementUpdateRequest }>} UpdateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById }>} DeleteUserRequest
 */

/**
 * @import { Request } from '@hapi/hapi'
 * @import { AuditUser, EntitlementUser, Roles } from '@defra/forms-model'
 * @import { Db } from 'mongodb'
 */
