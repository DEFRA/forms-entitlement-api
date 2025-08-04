import Joi from 'joi'

import { Roles } from '~/src/repositories/roles.js'

export const userIdSchema = Joi.object().keys({
  userId: Joi.string().required()
})

export const createUserSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  roles: Joi.array()
    .items(Joi.string().valid(Roles.Admin, Roles.FormCreator))
    .required()
})

export const updateUserSchema = Joi.object().keys({
  roles: Joi.array()
    .items(Joi.string().valid(Roles.Admin, Roles.FormCreator))
    .required()
})
