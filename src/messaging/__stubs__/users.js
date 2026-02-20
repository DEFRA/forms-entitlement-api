export const azureUser = /** @type {AzureUser} */ ({
  id: 'azure-user-id',
  email: 'azure-email@azure.com',
  displayName: 'Azure User'
})

export const callingUser = /** @type {CallingUser} */ ({
  id: '88c46e4b-c76b-40dc-801f-4743b784b176',
  displayName: 'Joe Bloggs',
  roles: ['admin']
})

export const superadminCallingUser = /** @type {CallingUser} */ ({
  id: '88c46e4b-c76b-40dc-801f-4743b784b176',
  displayName: 'Joe Bloggs',
  roles: ['superadmin']
})

export const adminRole = ['admin']

/**
 * @import { CallingUser } from '~/src/api/types.js'
 * @import { AzureUser } from '~/src/services/azure-ad.js'
 */
