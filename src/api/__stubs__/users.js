import { Roles, Scopes } from '@defra/forms-model'
import { ObjectId } from 'mongodb'

export const mockFormCreatorUser = {
  userId: 'user-id-creator',
  email: 'creator@defra.gov.uk',
  displayName: 'Form Creator User',
  roles: [Roles.FormCreator],
  scopes: [Scopes.FormRead, Scopes.FormEdit]
}

export const mockAdminUser = {
  userId: 'user-id-admin',
  email: 'admin@defra.gov.uk',
  displayName: 'Admin User',
  roles: [Roles.Admin],
  scopes: [
    Scopes.FormRead,
    Scopes.FormEdit,
    Scopes.FormDelete,
    Scopes.UserCreate,
    Scopes.UserDelete,
    Scopes.UserEdit
  ]
}

export const mockUserId1 = '111f119119e644a0a8c72118'
export const mockUserId2 = '222f119119e644a0a8c72118'
export const mockUserId3 = '333f119119e644a0a8c72118'

export const mockUserList = [
  { ...mockAdminUser },
  { ...mockFormCreatorUser, userId: 'user-id-creator2' },
  { ...mockFormCreatorUser }
]

export const mockUserListWithIds = [
  { ...mockAdminUser, _id: new ObjectId(mockUserId1) },
  {
    ...mockFormCreatorUser,
    userId: 'user-id-creator2',
    _id: new ObjectId(mockUserId2)
  },
  { ...mockFormCreatorUser, _id: new ObjectId(mockUserId3) }
]
