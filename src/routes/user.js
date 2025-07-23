import { RoleDescriptions, Roles } from '~/src/repositories/roles.js'
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema
} from '~/src/schemas/user.js'
import {
  addUser,
  getAllUsers,
  getUser,
  updateUser
} from '~/src/services/user.js'

/**
 * @type {ServerRoute[]}
 */
export default [
  {
    method: 'GET',
    path: '/users',
    handler: async (request, h) => {
      const entities = await getAllUsers()
      return h.response({ message: 'success', entities })
    }
  },
  {
    method: 'GET',
    path: '/users/{userId}',
    handler: async (request, h) => {
      const entity = await getUser(request.params.userId)
      return h.response({ message: 'success', entity })
    }
  },
  {
    method: 'POST',
    path: '/users',
    /**
     * @param {CreateUserRequest} request
     */
    handler: async (request, h) => {
      const entity = await addUser(
        request.payload.userId,
        request.payload.roles
      )
      return h.response({ message: 'success', entity })
    },
    options: {
      validate: {
        payload: createUserSchema
      }
    }
  },
  {
    method: 'PUT',
    path: '/users/{userId}',
    /**
     * @param {UpdateUserRequest} request
     */
    handler: async (request, h) => {
      const entity = await updateUser(
        request.params.userId,
        request.payload.roles
      )
      return h.response({ message: 'success', entity })
    },
    options: {
      validate: {
        payload: updateUserSchema,
        params: userIdSchema
      }
    }
  },
  {
    method: 'GET',
    path: '/roles',
    handler: (request, h) => {
      const roles = Object.entries(Roles).map((role) => ({
        name: role[1],
        description: RoleDescriptions[role[1]]
      }))
      return h.response({ message: 'success', roles })
    }
  }
]

/**
 * @import { ServerRoute } from '@hapi/hapi'
 * @import { CreateUserRequest, UpdateUserRequest } from '~/src/api/types.js'
 */
