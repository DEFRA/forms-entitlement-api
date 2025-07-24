/**
 * Base class to support all application errors.
 */
export class ApplicationError extends Error {
  name = 'ApplicationError'

  /**
   * HTTP status code
   * @type {number}
   */
  statusCode = 500

  /**
   * Constructs an error
   * @param {string} message - the message to report
   * @param {ErrorOptions & { statusCode?: number }} [options] - error options
   */
  constructor(message, options = {}) {
    super(message, options)
    if (options.statusCode) {
      this.statusCode = options.statusCode
    }
  }
}

/**
 * Indicates the user already exists so cannot be created again.
 */
export class UserAlreadyExistsError extends ApplicationError {
  name = 'UserAlreadyExistsError'

  /**
   * Constructs an error
   * @param {string} userId
   * @param {ErrorOptions} [options]
   */
  constructor(userId, options = {}) {
    super(`User with userID '${userId}' already exists`, {
      ...options,
      statusCode: 400
    })
  }
}
