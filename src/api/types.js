/**
 * @typedef {{ userId: string }} UserById
 * @typedef {{ email: string, roles: Roles[] }} UserEntitlementCreateRequest
 * @typedef {{ roles: Roles[] }} UserEntitlementUpdateRequest
 * @typedef {Request<{ Server: { db: Db }, Payload: UserEntitlementCreateRequest }>} CreateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById, Payload: UserEntitlementUpdateRequest }>} UpdateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById }>} DeleteUserRequest
 */

/**
 * @import { Request } from '@hapi/hapi'
 * @import { Roles } from '@defra/forms-model'
 * @import { Db } from 'mongodb'
 */
