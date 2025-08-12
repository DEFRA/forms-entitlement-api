/* eslint-env jest */

/**
 * @type {any}
 */
export const client = {
  startSession: () => ({
    endSession: jest.fn().mockResolvedValue(undefined),
    withTransaction: jest.fn(
      /**
       * Mock transaction handler
       * @param {() => Promise<void>} fn
       */
      async (fn) => fn()
    )
  }),
  close: jest.fn().mockImplementation(() => Promise.resolve())
}

/**
 * @type {any}
 */
export const db = {}

/**
 * @type {any}
 */
export const locker = {
  lock: jest.fn()
}

/**
 * Prepare the database and establish a connection
 */
export function prepareDb() {
  return Promise.resolve()
}

/**
 * @import { MongoClient, WithTransactionCallback } from 'mongodb'
 * @import { Logger } from 'pino'
 * @import { Mocked, Mock } from 'jest-mock'
 */
