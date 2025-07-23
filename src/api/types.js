/**
 * @typedef {{userId: string, roles: string[], scopes: string[]}} UserEntitlementDocument
 * @typedef {{ userId: string }} UserById
 * @typedef {{ userId: string, roles: string[] }} UserEntitlementCreateRequest
 * @typedef {{ roles: string[] }} UserEntitlementUpdateRequest
 * @typedef {Request<{ Server: { db: Db }, Payload: UserEntitlementCreateRequest }>} CreateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById, Payload: UserEntitlementUpdateRequest }>} UpdateUserRequest
 * @typedef {Request<{ Server: { db: Db }, Params: UserById }>} DeleteUserRequest
 */

/**
 * @import { Request } from '@hapi/hapi'
 * @import { Db } from 'mongodb'
 */
