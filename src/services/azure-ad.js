import { ClientSecretCredential } from '@azure/identity'
import { getErrorMessage } from '@defra/forms-model'
import Boom from '@hapi/boom'
import { Client } from '@microsoft/microsoft-graph-client'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js'
import { StatusCodes } from 'http-status-codes'

import { config } from '~/src/config/index.js'
import {
  GRAPH_ERROR_CODES,
  HTTP_RESPONSE_MESSAGES
} from '~/src/helpers/azure-error-constants.js'
import { createLogger } from '~/src/helpers/logging/logger.js'

const logger = createLogger()

/**
 * Check if error indicates a 404 Not Found condition
 * @param {string|undefined} errorCode - Graph API error code
 * @param {number|undefined} statusCode - HTTP status code
 * @returns {boolean} True if this is a 404 error
 */
function isNotFoundError(errorCode, statusCode) {
  return (
    statusCode === StatusCodes.NOT_FOUND ||
    errorCode === GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND ||
    errorCode === GRAPH_ERROR_CODES.RESOURCE_NOT_FOUND ||
    errorCode === GRAPH_ERROR_CODES.NOT_FOUND
  )
}

/**
 * Check if error indicates a 403 Forbidden condition
 * @param {string|undefined} errorCode - Graph API error code
 * @param {number|undefined} statusCode - HTTP status code
 * @returns {boolean} True if this is a 403 error
 */
function isForbiddenError(errorCode, statusCode) {
  return (
    statusCode === StatusCodes.FORBIDDEN ||
    errorCode === GRAPH_ERROR_CODES.AUTHORIZATION_REQUEST_DENIED ||
    errorCode === GRAPH_ERROR_CODES.ERROR_ACCESS_DENIED ||
    errorCode === GRAPH_ERROR_CODES.ACCESS_DENIED ||
    errorCode === GRAPH_ERROR_CODES.ACCESS_DENIED_LOWER
  )
}

/**
 * Convert Microsoft Graph SDK errors to appropriate Boom errors
 * @param {any} error - Graph SDK error
 * @param {string} operation - Description of the operation that failed
 * @returns {never} Always throws a Boom error
 */
function handleGraphError(error, operation) {
  const errorCode = error.code ?? error.error?.code
  const statusCode = error.statusCode ?? error.status

  if (isNotFoundError(errorCode, statusCode)) {
    throw Boom.notFound(
      `${HTTP_RESPONSE_MESSAGES.USER_NOT_FOUND}: ${operation}`
    )
  }

  if (isForbiddenError(errorCode, statusCode)) {
    throw Boom.forbidden(
      `${HTTP_RESPONSE_MESSAGES.PERMISSION_DENIED}: ${operation}`
    )
  }

  throw Boom.internal(
    `Graph API error: ${operation} - ${getErrorMessage(error)}`
  )
}

/**
 * Azure AD service for interacting with Microsoft Graph API
 */
class AzureAdService {
  /**
   * Create Azure AD service instance
   */
  constructor() {
    const clientId = config.get('azure.clientId')
    const clientSecret = config.get('azure.clientSecret')
    const tenantId = config.get('azure.tenantId')

    if (!clientSecret) {
      throw new Error('Azure client secret is required for Graph API access')
    }

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    )
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    })

    this.graphClient = Client.initWithMiddleware({ authProvider })
  }

  /**
   * Get group members from Azure AD
   * @param {string} groupId - The Azure AD group ID
   * @returns {Promise<AzureUser[]>} Array of group members
   */
  async getGroupMembers(groupId) {
    try {
      logger.info(
        `[azureFetchGroupMembers] Fetching members for group: ${groupId}`
      )

      const members = await this.graphClient
        .api(`/groups/${groupId}/members`)
        .select('id,displayName,mail,userPrincipalName')
        .get()

      const users = members.value
        .filter(
          /** @param {any} member */ (member) =>
            member['@odata.type'] === '#microsoft.graph.user'
        )
        .map(
          /** @param {any} user */ (user) => ({
            id: user.id,
            displayName: user.displayName,
            email: user.mail ?? user.userPrincipalName
          })
        )

      logger.info(
        `[azureFetchGroupMembers] Found ${users.length} users in group ${groupId}`
      )
      return users
    } catch (err) {
      logger.error(
        err,
        `[azureFetchGroupMembers] Failed to fetch group members for ${groupId}: ${getErrorMessage(err)}`
      )
      throw Boom.internal(
        `Failed to fetch group members: ${getErrorMessage(err)}`
      )
    }
  }

  /**
   * Look up a user by email address and get their Azure AD details
   * @param {string} email - The user's email address
   * @returns {Promise<AzureUser>} User details from Azure AD
   */
  async getUserByEmail(email) {
    logger.info(`[azureGetUserByEmail] Looking up user by email: ${email}`)

    try {
      const user = await this.graphClient
        .api(`/users/${email}`)
        .select('id,givenName,surname,displayName,mail,userPrincipalName')
        .get()

      const firstName = user.givenName
      const lastName = user.surname
      const displayName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : (user.displayName ?? '')

      const foundUser = {
        id: user.id,
        displayName,
        email: user.mail ?? user.userPrincipalName
      }

      logger.info(`[azureGetUserByEmail] Found user: ${user.id} (${email})`)
      return foundUser
    } catch (err) {
      logger.error(
        err,
        `[azureGetUserByEmail] Failed to find user by email ${email}: ${getErrorMessage(err)}`
      )
      return handleGraphError(err, 'looking up user by email')
    }
  }

  /**
   * Validate if a user exists in Azure AD and get their details
   * @param {string} userId - The Azure AD user ID (object ID)
   * @returns {Promise<AzureUser>} User details from Azure AD
   */
  async validateUser(userId) {
    logger.info(`[azureValidateUser] Validating user: ${userId}`)

    try {
      const user = await this.graphClient
        .api(`/users/${userId}`)
        .select('id,givenName,surname,displayName,mail,userPrincipalName')
        .get()

      const firstName = user.givenName
      const lastName = user.surname
      const displayName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : (user.displayName ?? '')

      const validatedUser = {
        id: user.id,
        displayName,
        email: user.mail ?? user.userPrincipalName
      }

      logger.info(`[azureValidateUser] User validated: ${userId}`)
      return validatedUser
    } catch (err) {
      logger.error(
        err,
        `[azureValidateUser] Failed to validate user ${userId}: ${getErrorMessage(err)}`
      )
      return handleGraphError(err, `validating user ${userId}`)
    }
  }
}

let azureAdService = null

/**
 * Get the Azure AD service instance
 * @returns {AzureAdService} The Azure AD service instance
 */
export function getAzureAdService() {
  azureAdService ??= new AzureAdService()
  return azureAdService
}

/**
 * @typedef {object} AzureUser
 * @property {string} id - Azure AD object ID
 * @property {string} displayName - User's display name (givenName + surname)
 * @property {string} email - User's email address
 */
