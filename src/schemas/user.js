import Joi from 'joi'

import { Roles } from '~/src/repositories/roles.js'

// User id
export const userIdSchema = Joi.object().keys({
  userId: Joi.string().required()
})

// Create user schema
export const createUserSchema = Joi.object().keys({
  userId: Joi.string().required(),
  roles: Joi.array()
    .items(Joi.string().valid(Roles.Admin, Roles.FormCreator))
    .required()
})

// Create user schema
export const updateUserSchema = Joi.object().keys({
  roles: Joi.array()
    .items(Joi.string().valid(Roles.Admin, Roles.FormCreator))
    .required()
})
