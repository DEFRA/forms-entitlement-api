export const HTTP_RESPONSE_MESSAGES = {
  PERMISSION_DENIED: 'Permission denied',
  USER_NOT_FOUND: 'User not found',
  VALIDATION_FAILED: 'User validation failed',
  BATCH_VALIDATION_FAILED: 'Batch validation failed',
  MIGRATION_FAILED: 'Migration failed'
}

export const GRAPH_ERROR_CODES = {
  // Permission/Authorization errors from MS's docs -> 403 Forbidden
  AUTHORIZATION_REQUEST_DENIED: 'Authorization_RequestDenied',
  ERROR_ACCESS_DENIED: 'ErrorAccessDenied',
  ACCESS_DENIED: 'AccessDenied',
  ACCESS_DENIED_LOWER: 'accessDenied',

  // Resource not found errors from MS's docs -> 404 Not Found
  REQUEST_RESOURCE_NOT_FOUND: 'Request_ResourceNotFound',
  RESOURCE_NOT_FOUND: 'ResourceNotFound',
  NOT_FOUND: 'notFound'
}
