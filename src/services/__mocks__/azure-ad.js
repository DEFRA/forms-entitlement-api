// Mock Azure AD service for testing

const mockAzureUsers = [
  {
    id: '86758ba9-92e7-4287-9751-7705e449688e',
    displayName: 'John Doe',
    email: 'john.doe@defra.gov.uk'
  },
  {
    id: '12345678-1234-1234-1234-123456789012',
    displayName: 'Jane Smith',
    email: 'jane.smith@defra.gov.uk'
  }
]

/**
 * Mock Azure AD service for testing
 */
class MockAzureAdService {
  /**
   * Mock get group members (internal use only)
   * @param {string} groupId - Group ID
   * @returns {Promise<object[]>} Mock users
   */
  getGroupMembers(groupId) {
    // Handle role editor group ID (used for both admin sync and migration)
    if (groupId === '7049296f-2156-4d61-8ac3-349276438ef9') {
      return Promise.resolve(mockAzureUsers)
    }
    return Promise.reject(new Error(`Group not found: ${groupId}`))
  }

  /**
   * Mock validate user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Mock user
   */
  validateUser(userId) {
    const user = mockAzureUsers.find((u) => u.id === userId)
    if (!user) {
      return Promise.reject(new Error(`User not found in Azure AD: ${userId}`))
    }
    return Promise.resolve(user)
  }
}

/**
 * Mock Azure AD service singleton
 */
let mockAzureAdService = null

/**
 * Get mock Azure AD service instance
 * @returns {MockAzureAdService} Mock Azure AD service
 */
export function getAzureAdService() {
  mockAzureAdService ??= new MockAzureAdService()
  return mockAzureAdService
}
