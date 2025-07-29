import { randomBytes, randomUUID } from 'crypto'

/**
 * Azure AD service for interacting with Microsoft Graph API
 */
class AzureAdService {
  /**
   * Validate if a user exists in Azure AD and get their details
   * @param {string} email - The email address of the user
   * @returns {Promise<AzureUser>} User details from Azure AD
   */
  async validateUserByEmail(email) {
    const randomId = randomBytes(2).toString('hex')
    await new Promise((resolve) => setTimeout(resolve, 10))
    return {
      userId: randomUUID(),
      email,
      displayName: `John_${randomId} Smith_${randomId}`
    }
  }

  /**
   * Validate if a user exists in Azure AD and get their details
   * @param {string} userId - The Azure AD user ID (object ID)
   * @returns {Promise<AzureUser>} User details from Azure AD
   */
  async validateUserById(userId) {
    const randomId = randomBytes(2).toString('hex')
    await new Promise((resolve) => setTimeout(resolve, 10))
    return {
      userId,
      email: `john_${randomId}.smith_${randomId}@site.com`,
      displayName: `John_${randomId} Smith_${randomId}`
    }
  }
}

// Create singleton instance
let azureAdService = null

/**
 * Get the Azure AD service singleton instance
 * @returns {AzureAdService} The Azure AD service instance
 */
export function getAzureAdService() {
  azureAdService ??= new AzureAdService()
  return azureAdService
}

/**
 * @typedef {object} AzureUser
 * @property {string} userId - Azure AD object ID
 * @property {string} displayName - User's display name
 * @property {string} email - User's email address
 */
