import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

/**
 * In-memory UnitOfWork that executes the function directly, without a
 * transaction. Sufficient for unit tests where repositories are in-memory fakes.
 */
export class FakeUnitOfWork extends UnitOfWorkPort {
  execute<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}
