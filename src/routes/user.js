import { RoleDetails, Roles } from '~/src/repositories/roles.js'
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema
} from '~/src/schemas/user.js'
import {
  addUser,
  deleteUser,
  getAllUsers,
  getUser,
  updateUser
} from '~/src/services/user.js'

const USER_BY_ID_PATH = '/users/{userId}'

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
    path: USER_BY_ID_PATH,
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
      const result = await addUser(
        request.payload.userId,
        request.payload.roles
      )
      return h.response({ message: result.status, id: result.id })
    },
    options: {
      validate: {
        payload: createUserSchema
      }
    }
  },
  {
    method: 'PUT',
    path: USER_BY_ID_PATH,
    /**
     * @param {UpdateUserRequest} request
     */
    handler: async (request, h) => {
      const result = await updateUser(
        request.params.userId,
        request.payload.roles
      )
      return h.response({ message: result.status, id: result.id })
    },
    options: {
      validate: {
        payload: updateUserSchema,
        params: userIdSchema
      }
    }
  },
  {
    method: 'DELETE',
    path: USER_BY_ID_PATH,
    /**
     * @param {DeleteUserRequest} request
     */
    handler: async (request, h) => {
      const result = await deleteUser(request.params.userId)
      return h.response({ message: result.status, id: result.id })
    },
    options: {
      validate: {
        params: userIdSchema
      }
    }
  },
  {
    method: 'GET',
    path: '/roles',
    handler: (_request, h) => {
      const roles = Object.entries(Roles).map((role) => {
        const roleDetails = RoleDetails[role[1]]
        return {
          name: roleDetails.name,
          code: roleDetails.code,
          description: roleDetails.description
        }
      })
      return h.response({ message: 'success', roles })
    }
  }
]

/**
 * @import { ServerRoute } from '@hapi/hapi'
 * @import { CreateUserRequest, DeleteUserRequest, UpdateUserRequest } from '~/src/api/types.js'
 */
