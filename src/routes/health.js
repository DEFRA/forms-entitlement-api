import { StatusCodes } from 'http-status-codes'

/**
 * @type {ServerRoute}
 */
export default {
  method: 'GET',
  path: '/health',
  handler(request, h) {
    return h.response({ message: 'success' }).code(StatusCodes.OK)
  },
  options: {
    auth: false
  }
}

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
