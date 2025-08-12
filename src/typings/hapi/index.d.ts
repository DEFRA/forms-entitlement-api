import { UserCredentials, ServerApplicationState } from '@hapi/hapi'

declare module '@hapi/hapi' {
  interface UserCredentials {
    /**
     * Object ID of the user
     */
    oid?: string

    /**
     * Groups of the user
     */
    groups?: string[]
  }

  interface ServerApplicationState {
    /**
     * Scheduler service instance for managing cron jobs
     */
    scheduler?: {
      start(): void
      stop(): void
      scheduleTask(
        name: string,
        cronExpression: string,
        taskFunction: Function,
        runImmediately?: boolean
      ): boolean
      triggerTask(name: string): Promise<boolean>
    } | null
  }
}
