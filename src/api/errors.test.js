import { ApplicationError, UserAlreadyExistsError } from '~/src/api/errors.js'

const badRequestErrorCode = 400

describe('errors', () => {
  describe('ApplicationError', () => {
    test('should instantiate', () => {
      const error = new ApplicationError('error-message')
      expect(error).toBeInstanceOf(ApplicationError)
      expect(error.message).toBe('error-message')
    })

    test('should instantiate with a status code', () => {
      const error = new ApplicationError('error-message', {
        statusCode: badRequestErrorCode
      })
      expect(error).toBeInstanceOf(ApplicationError)
      expect(error.message).toBe('error-message')
      expect(error.statusCode).toBe(badRequestErrorCode)
    })
  })

  describe('UserAlreadyExistsError', () => {
    test('should instantiate', () => {
      const error = new UserAlreadyExistsError('user-id1')
      expect(error).toBeInstanceOf(UserAlreadyExistsError)
      expect(error.message).toBe("User with userID 'user-id1' already exists")
      expect(error.statusCode).toBe(badRequestErrorCode)
    })
  })
})
