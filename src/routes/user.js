import Boom from '@hapi/boom'

import { findAllExampleData, findExampleData } from '~/src/example-find.js'

/**
 * @type {ServerRoute[]}
 */
export default [
  {
    method: 'GET',
    path: '/users',
    handler: async (request, h) => {
      const entities = await findAllExampleData()
      return h.response({ message: 'success', entities })
    }
  },
  {
    method: 'GET',
    path: '/user/{userId}',
    handler: async (request, h) => {
      const entity = await findExampleData(request.params.userId)

      if (!entity) {
        return Boom.notFound()
      }

      return h.response({ message: 'success', entity })
    }
  }
]

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
