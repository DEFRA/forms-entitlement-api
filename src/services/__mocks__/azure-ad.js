/**
 * Mock Azure AD service for testing
 */

/**
 * Mock implementation of validateUser
 * @param {string} userId - The user ID to validate
 * @returns {Promise<import('../azure-ad.js').AzureUser>} Mock user data
 */
export async function validateUser(userId) {
  if (userId === 'invalid-user-id') {
    throw new Error('User not found in Azure AD: invalid-user-id')
  }

  return Promise.resolve({
    id: userId,
    displayName: 'Test User',
    email: 'test@defra.gov.uk'
  })
}

/**
 * Mock implementation of getUserByEmail
 * @param {string} email - The user's email
 * @returns {Promise<import('../azure-ad.js').AzureUser>} Mock user data
 */
export async function getUserByEmail(email) {
  if (email === 'notfound@defra.gov.uk') {
    throw new Error('User not found in Azure AD: notfound@defra.gov.uk')
  }

  const mockUserId = `user-${email.replace('@', '-').replace('.', '-')}`

  return Promise.resolve({
    id: mockUserId,
    displayName: 'Test User',
    email
  })
}

/**
 * Mock implementation of getGroupMembers
 * @param {string} groupId - The group ID
 * @returns {Promise<import('../azure-ad.js').AzureUser[]>} Mock group members
 */
export async function getGroupMembers(groupId) {
  if (groupId === '7049296f-2156-4d61-8ac3-349276438ef9') {
    return Promise.resolve([
      {
        id: 'user1-id',
        displayName: 'User 1',
        email: 'user1@defra.gov.uk'
      },
      {
        id: 'user2-id',
        displayName: 'User 2',
        email: 'user2@defra.gov.uk'
      }
    ])
  }

  return Promise.resolve([])
}

/**
 * Get mock Azure AD service instance
 * @returns {object} Mock Azure AD service with methods
 */
export function getAzureAdService() {
  return {
    validateUser,
    getUserByEmail,
    getGroupMembers
  }
}
