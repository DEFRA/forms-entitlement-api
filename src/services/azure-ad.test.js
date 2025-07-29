import { getAzureAdService } from '~/src/services/azure-ad.js'

describe('Azure AD service', () => {
  describe('validateUserByEmail', () => {
    it('should validate ok', async () => {
      const service = getAzureAdService()
      const res = await service.validateUserByEmail('email@email.com')
      expect(res.email).toBe('email@email.com')
      expect(res.userId).toBeDefined()
    })
  })

  describe('validateUserById', () => {
    it('should validate ok', async () => {
      const service = getAzureAdService()
      const res = await service.validateUserById('my-user-id')
      expect(res.email).toBeDefined()
      expect(res.userId).toBe('my-user-id')
    })
  })
})
