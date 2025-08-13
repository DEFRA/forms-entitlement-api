import { jest } from '@jest/globals'

const buildMockLockManager = () => {
  return {
    lock: /** @type {jest.MockedFunction<(key: string) => Promise<any>>} */ (
      jest.fn()
    )
  }
}

const buildMockLock = () => {
  return {
    free: /** @type {jest.MockedFunction<() => Promise<void>>} */ (jest.fn())
  }
}

const mockLockManager = buildMockLockManager()

jest.mock('~/src/mongo.js', () => ({
  locker: {
    locker: mockLockManager
  }
}))

describe('lock-repository', () => {
  /** @type {import('~/src/repositories/lock-repository.js')} */
  let lockRepository

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    lockRepository = await import('~/src/repositories/lock-repository.js')
  })

  describe('withLock', () => {
    test('should execute function when lock is acquired', async () => {
      const mockLockObj = buildMockLock()
      mockLockManager.lock.mockResolvedValue(mockLockObj)
      mockLockObj.free.mockResolvedValue(undefined)

      const testFn = jest.fn(() => Promise.resolve('test-result'))

      const result = await lockRepository.withLock('test-lock', testFn)

      expect(result).toBe('test-result')
      expect(mockLockManager.lock).toHaveBeenCalledWith('test-lock')
      expect(testFn).toHaveBeenCalled()
      expect(mockLockObj.free).toHaveBeenCalled()
    })

    test('should return null when lock cannot be acquired', async () => {
      mockLockManager.lock.mockResolvedValue(null)

      const testFn = jest.fn()

      const result = await lockRepository.withLock('test-lock', testFn)

      expect(result).toBeNull()
      expect(testFn).not.toHaveBeenCalled()
    })

    test('should release lock even if function throws', async () => {
      const mockLockObj = buildMockLock()
      mockLockManager.lock.mockResolvedValue(mockLockObj)
      mockLockObj.free.mockResolvedValue(undefined)

      const testError = new Error('Test error')
      const testFn = jest.fn(() => Promise.reject(testError))

      await expect(
        lockRepository.withLock('test-lock', testFn)
      ).rejects.toThrow('Test error')

      expect(mockLockObj.free).toHaveBeenCalled()
    })

    test('should pass through the function result', async () => {
      const mockLockObj = buildMockLock()
      mockLockManager.lock.mockResolvedValue(mockLockObj)
      mockLockObj.free.mockResolvedValue(undefined)

      const complexResult = { data: 'test', count: 42 }
      const testFn = jest.fn(() => Promise.resolve(complexResult))

      const result = await lockRepository.withLock('admin-user-sync', testFn)

      expect(result).toEqual(complexResult)
      expect(mockLockManager.lock).toHaveBeenCalledWith('admin-user-sync')
    })
  })
})
