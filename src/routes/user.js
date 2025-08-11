import Boom from '@hapi/boom'

import { getCallingUser } from '~/src/helpers/auth-helper.js'
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

const INTERNAL_ERROR_GENERIC = 'An error occurred while processing your request'

/**
 * @type {ServerRoute[]}
 */
export default [
  {
    method: 'GET',
    path: '/users',
    handler: async (request, h) => {
      const entities = await getAllUsers()
      return h.response({ entities })
    }
  },
  {
    method: 'GET',
    path: USER_BY_ID_PATH,
    handler: async (request, h) => {
      const entity = await getUser(request.params.userId)
      return h.response({ entity })
    }
  },
  {
    method: 'POST',
    path: '/users',
    /**
     * @param {CreateUserRequest} request
     */
    handler: async (request, h) => {
      try {
        const { auth } = request
        const callingUser = getCallingUser(auth.credentials.user)

        const result = await addUser(
          request.payload.email,
          request.payload.roles,
          callingUser
        )

        const createdUser = await getUser(result.id)

        return h.response({
          id: result.id,
          email: result.email,
          displayName: result.displayName,
          entity: createdUser
        })
      } catch (error) {
        if (Boom.isBoom(error)) {
          throw error
        }

        throw Boom.internal(INTERNAL_ERROR_GENERIC)
      }
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
      try {
        const { auth } = request
        const callingUser = getCallingUser(auth.credentials.user)

        const result = await updateUser(
          request.params.userId,
          request.payload.roles,
          callingUser
        )
        return h.response({ id: result.id })
      } catch (error) {
        if (Boom.isBoom(error)) {
          throw error
        }

        throw Boom.internal(INTERNAL_ERROR_GENERIC)
      }
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
      try {
        const { auth } = request
        const callingUser = getCallingUser(auth.credentials.user)

        const result = await deleteUser(request.params.userId, callingUser)

        return h.response({ id: result.id })
      } catch (error) {
        if (Boom.isBoom(error)) {
          throw error
        }

        throw Boom.internal(INTERNAL_ERROR_GENERIC)
      }
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
          code: roleDetails.code
        }
      })
      return h.response({ roles })
    }
  }
]

/**
 * @import { ServerRoute } from '@hapi/hapi'
 * @import { CreateUserRequest, DeleteUserRequest, UpdateUserRequest } from '~/src/api/types.js'
 */
