import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import { createServer } from '~/src/api/server.js'

jest.mock('~/src/services/scheduler.js', () => ({
  initialiseAdminUserSync: jest.fn(() => null)
}))
jest.mock('~/src/mongo.js')

describe('Scheduler Routes', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  /** @type {{ start: jest.MockedFunction<() => void>, stop: jest.MockedFunction<() => void>, scheduleTask: jest.MockedFunction<(name: string, cronExpression: string, taskFunction: Function, runImmediately?: boolean) => boolean>, triggerTask: jest.MockedFunction<(taskName: string) => Promise<boolean>> }} */
  const mockScheduler = {
    start: jest.fn(),
    stop: jest.fn(),
    scheduleTask: jest.fn(),
    triggerTask: jest.fn()
  }

  beforeEach(async () => {
    server = await createServer()
    await server.initialize()
    server.app.scheduler = mockScheduler
    jest.clearAllMocks()
  })

  describe('POST /scheduler/sync-admin-users', () => {
    test('should trigger admin user sync successfully', async () => {
      mockScheduler.triggerTask.mockResolvedValue(true)

      const response = await server.inject({
        method: 'POST',
        url: '/scheduler/sync-admin-users'
      })

      expect(response.statusCode).toBe(200)
      const payload = JSON.parse(response.payload)
      expect(payload).toEqual({
        status: 'success',
        message: 'Admin user sync triggered successfully'
      })
      expect(mockScheduler.triggerTask).toHaveBeenCalledWith('admin-user-sync')
    })

    test('should return 500 if sync fails', async () => {
      mockScheduler.triggerTask.mockResolvedValue(false)

      const response = await server.inject({
        method: 'POST',
        url: '/scheduler/sync-admin-users'
      })

      expect(response.statusCode).toBe(500)
      const payload = JSON.parse(response.payload)
      expect(payload.message).toContain('An internal server error occurred')
    })

    test('should return 500 if scheduler service is not available', async () => {
      const originalScheduler = server.app.scheduler
      delete server.app.scheduler

      const response = await server.inject({
        method: 'POST',
        url: '/scheduler/sync-admin-users'
      })

      expect(response.statusCode).toBe(500)
      const payload = JSON.parse(response.payload)
      expect(payload.message).toContain('An internal server error occurred')

      server.app.scheduler = originalScheduler
    })

    test('should handle scheduler trigger errors', async () => {
      mockScheduler.triggerTask.mockRejectedValue(new Error('Trigger failed'))

      const response = await server.inject({
        method: 'POST',
        url: '/scheduler/sync-admin-users'
      })

      expect(response.statusCode).toBe(500)
    })
  })
})
