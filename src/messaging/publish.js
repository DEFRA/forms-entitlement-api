import { messageSchema } from '@defra/forms-model'
import Joi from 'joi'

import {
  entitlementCreatedMapper,
  entitlementDeletedMapper,
  entitlementUpdatedMapper
} from '~/src/messaging/mappers/events.js'
import { publishEvent } from '~/src/messaging/publish-base.js'

/**
 * Helper to validate and publish an event
 * @param {AuditMessage} auditMessage
 */
async function validateAndPublishEvent(auditMessage) {
  const value = Joi.attempt(auditMessage, messageSchema, {
    abortEarly: false
  })

  return publishEvent(value)
}

/**
 * Publish entitlement created event
 * @param {AzureUser} azureUser
 * @param {string[]} roles
 * @param {AuditUser} callingUser
 */
export async function publishEntitlementCreatedEvent(
  azureUser,
  roles,
  callingUser
) {
  const auditMessage = entitlementCreatedMapper(azureUser, roles, callingUser)

  return validateAndPublishEvent(auditMessage)
}

/**
 * Publish entitlement updated event
 * @param {AzureUser} azureUser
 * @param {string[]} roles
 * @param {AuditUser} callingUser
 */
export async function publishEntitlementUpdatedEvent(
  azureUser,
  roles,
  callingUser
) {
  const auditMessage = entitlementUpdatedMapper(azureUser, roles, callingUser)

  return validateAndPublishEvent(auditMessage)
}

/**
 * Publish entitlement deleted event
 * @param {AzureUser} azureUser
 * @param {AuditUser} callingUser
 */
export async function publishEntitlementDeletedEvent(azureUser, callingUser) {
  const auditMessage = entitlementDeletedMapper(azureUser, callingUser)

  return validateAndPublishEvent(auditMessage)
}

/**
 * @import { AuditMessage, AuditUser } from '@defra/forms-model'
 * @import { AzureUser } from '~/src/services/azure-ad.js'
 */
