import { RoleScopes, Roles } from '@defra/forms-model'

export const auth = {
  strategy: 'azure-oidc-token',
  credentials: {
    user: {
      aud: '6be2d9fd-fe1e-47eb-9821-b6f6cd3ceba1',
      iss: 'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/v2.0',
      family_name: 'Chase',
      given_name: 'Enrique',
      name: 'Enrique Chase (Defra)',
      scp: 'forms.user',
      sub: 'hgtL_1p2Me5JkBB6JeB20PyU3YDuP9PjEZwi7m1QGng',
      oid: 'aaaaaaaa-1111-2222-3333-444444444444'
    },
    scope: RoleScopes[Roles.Admin],
    roles: [Roles.Admin]
  }
}

export const superadminAuth = {
  strategy: 'azure-oidc-token',
  credentials: {
    user: {
      aud: '6be2d9fd-fe1e-47eb-9821-b6f6cd3ceba1',
      iss: 'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/v2.0',
      family_name: 'Super',
      given_name: 'Admin',
      name: 'Super Admin (Defra)',
      scp: 'forms.user',
      sub: 'superadmin-sub-1',
      oid: '86758ba9-92e7-4287-9751-7705e449688e'
    },
    scope: RoleScopes[Roles.Superadmin],
    roles: [Roles.Superadmin]
  }
}

export const adminAuth = auth

export const formCreatorAuth = {
  strategy: 'azure-oidc-token',
  credentials: {
    user: {
      aud: '6be2d9fd-fe1e-47eb-9821-b6f6cd3ceba1',
      iss: 'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/v2.0',
      family_name: 'Creator',
      given_name: 'Form',
      name: 'Form Creator (Defra)',
      scp: 'forms.user',
      sub: 'formcreator-sub-1',
      oid: 'bbbbbbbb-1111-2222-3333-444444444444'
    },
    scope: RoleScopes[Roles.FormCreator],
    roles: [Roles.FormCreator]
  }
}

export const noEntitlementAuth = {
  strategy: 'azure-oidc-token',
  credentials: {
    user: {
      aud: '6be2d9fd-fe1e-47eb-9821-b6f6cd3ceba1',
      iss: 'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/v2.0',
      family_name: 'None',
      given_name: 'Entitlement',
      name: 'Entitlement None (Defra)',
      scp: 'forms.user',
      sub: 'noentitlement-sub-1',
      oid: 'cccccccc-1111-2222-3333-444444444444'
    },
    scope: [],
    roles: []
  }
}
