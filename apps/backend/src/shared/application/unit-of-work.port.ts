export abstract class UnitOfWorkPort {
  /**
   * Executes and return the `fn` async function in a "transactional" way such that
   * any uncaught exception will stop the whole unit of work.
   */
  abstract execute<T>(fn: () => Promise<T>): Promise<T>;
}
