import { getCallingUser } from '~/src/helpers/auth-helper.js'

describe('auth-helper', () => {
  describe('getCallingUser', () => {
    test('should throw if user missing', () => {
      expect(() => getCallingUser({})).toThrow(
        'Failed to get the calling user. User is undefined or has a malformed/missing oid/name.'
      )
    })

    test('should return user details', () => {
      const user = getCallingUser({
        oid: 'user-guid',
        name: 'users name',
        given_name: 'given',
        family_name: 'family'
      })
      expect(user).toEqual({
        id: 'user-guid',
        displayName: 'given family'
      })
    })

    test('should return user details defaulting to name if not family/given name', () => {
      const user = getCallingUser({
        oid: 'user-guid',
        name: 'users name'
      })
      expect(user).toEqual({
        id: 'user-guid',
        displayName: 'users name'
      })
    })
  })
})
