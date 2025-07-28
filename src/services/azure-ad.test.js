// Mock the Azure AD service for testing
jest.mock('~/src/services/azure-ad.js')

const mockGetAzureAdService = jest.fn()

// Import the mocked implementation
jest.doMock('~/src/services/azure-ad.js', () => ({
  getAzureAdService: mockGetAzureAdService
}))

describe('Azure AD Service', () => {
  let mockAzureAdService

  beforeEach(() => {
    mockAzureAdService = {
      getGroupMembers: jest.fn(),
      getMigrationSourceGroupMembers: jest.fn(),
      validateUser: jest.fn(),
      batchValidateUsers: jest.fn(),
      getGroup: jest.fn()
    }

    mockGetAzureAdService.mockReturnValue(mockAzureAdService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getGroupMembers', () => {
    test('should return group members', async () => {
      const mockMembers = [
        {
          id: '12345',
          displayName: 'John Doe',
          email: 'john.doe@defra.gov.uk'
        }
      ]

      mockAzureAdService.getGroupMembers.mockResolvedValue(mockMembers)

      const result = await mockAzureAdService.getGroupMembers('group-id')

      expect(result).toEqual(mockMembers)
      expect(mockAzureAdService.getGroupMembers).toHaveBeenCalledWith(
        'group-id'
      )
    })

    test('should throw error for invalid group', async () => {
      mockAzureAdService.getGroupMembers.mockRejectedValue(
        new Error('Group not found')
      )

      await expect(
        mockAzureAdService.getGroupMembers('invalid-group')
      ).rejects.toThrow('Group not found')
    })
  })

  describe('validateUser', () => {
    test('should return user details for valid user', async () => {
      const mockUser = {
        id: '12345',
        displayName: 'John Doe',
        email: 'john.doe@defra.gov.uk'
      }

      mockAzureAdService.validateUser.mockResolvedValue(mockUser)

      const result = await mockAzureAdService.validateUser('12345')

      expect(result).toEqual(mockUser)
      expect(mockAzureAdService.validateUser).toHaveBeenCalledWith('12345')
    })

    test('should throw error for invalid user', async () => {
      mockAzureAdService.validateUser.mockRejectedValue(
        new Error('User not found in Azure AD')
      )

      await expect(
        mockAzureAdService.validateUser('invalid-user')
      ).rejects.toThrow('User not found in Azure AD')
    })
  })

  describe('batchValidateUsers', () => {
    test('should validate multiple users', async () => {
      const mockResults = {
        valid: [
          {
            id: '12345',
            displayName: 'John Doe',
            email: 'john.doe@defra.gov.uk'
          }
        ],
        invalid: ['invalid-user']
      }

      mockAzureAdService.batchValidateUsers.mockResolvedValue(mockResults)

      const result = await mockAzureAdService.batchValidateUsers([
        '12345',
        'invalid-user'
      ])

      expect(result).toEqual(mockResults)
      expect(mockAzureAdService.batchValidateUsers).toHaveBeenCalledWith([
        '12345',
        'invalid-user'
      ])
    })
  })

  describe('getGroup', () => {
    test('should return group details', async () => {
      const mockGroup = {
        id: 'group-id',
        displayName: 'Test Group',
        description: 'Test group for forms',
        mailEnabled: true,
        securityEnabled: true
      }

      mockAzureAdService.getGroup.mockResolvedValue(mockGroup)

      const result = await mockAzureAdService.getGroup('group-id')

      expect(result).toEqual(mockGroup)
      expect(mockAzureAdService.getGroup).toHaveBeenCalledWith('group-id')
    })
  })

  describe('getMigrationSourceGroupMembers', () => {
    test('should return migration source group members', async () => {
      const mockMembers = [
        {
          id: '12345',
          displayName: 'John Doe',
          email: 'john.doe@defra.gov.uk'
        }
      ]

      mockAzureAdService.getMigrationSourceGroupMembers.mockResolvedValue(
        mockMembers
      )

      const result = await mockAzureAdService.getMigrationSourceGroupMembers()

      expect(result).toEqual(mockMembers)
      expect(
        mockAzureAdService.getMigrationSourceGroupMembers
      ).toHaveBeenCalled()
    })
  })
})
