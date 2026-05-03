# Backend Database Transactions

## What is a Unit Of Work

A Unit of Work is a behavioral design pattern that helps manage complex transactions and maintain data consistency and integrity.

It ensures that a set of changes to your data is treated as a single unit, and either all changes are successfully applied or none are.  
This is especially critical in enterprise applications, where multiple operations on different data sources need to be coordinated and committed atomically.

## Why and when Unit Of Work is necessary

To avoid leaking 'database transaction' APIs, which are isolated in the _persistence_ layer, we use the `UnitOfWorkPort` class that must be bound to the `DatabaseUnitOfWork` adapter in some 'infrastructure' module.  
This way, high-level abstractions (e.g., domain services) will not depend on low-level abstractions (e.g., persistence).

It should be used when we need to ensure that an operation is not persisted to the Database in case of any uncaught exception.

In summary, the Unit of Work pattern is relevant for:

- Consolidating multiple database operations into a single transaction. It ensures that all changes are applied or none at all
- Preventing partial updates that can lead to data corruption
- Decoupling transaction management logic from business logic
- Reducing the number of open connections and transactions, improving the performance

## How to use the Unit Of Work

Typically, it will be used in classes in `/application/use-cases` or `/services` via Port:

```ts
@Injectable()
export class MyUseCase {
  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute() {
    const result = await this.unitOfWork.execute(async () => {
      // ... operations within the unit of work
      const foobar = await Promise.resolve({ foo: "bar" });
      return foobar;
    });
    console.log(result === foobar); // true

    // another operations outside of the unit ...
  }
}
```

## Usage Considerations

Disclaimer: This project implements only one adapter for the `UnitOfWorkPort` port, in the persistence layer called `DatabaseUnitOfWork`. Therefore, all conclusions defined here are based on this.

- The composition of multiple nested Unit Of Works in the same call stack implies that all units will use the same database transaction. This can be seen in the implementation of `DatabaseUnitOfWork#execute`
  - That is, there are no 'nested transactions'
  - That is, in case of calls to different functions that use `this.unitOfWork.execute()` and end up generating an implicit nesting, it will be possible to query DB rows that have not yet been COMMITted

- The use of separate and non-nested Unit of Works implies using multiple database transactions, one for each call to `DatabaseUnitOfWork#execute`

- The use of `db.transaction().execute(async (tx) => { ... })` may generate the error `Error: calling the transaction method for a Transaction is not supported`
  - Reason: Known limitation in Kysely at https://github.com/kysely-org/kysely/issues/1498 for 'nested transaction'
  - Solution: use another connection instead of `this.currentTransaction`, using

  ```ts
  // NOTE: This code should be in some 'repository', not in the domain or application layers
  const db2 = this.dbClient.connection;
  // ...
  // creates a new database transaction
  await db2
    .transaction()
    .setIsolationLevel("read committed")
    .execute(async (tx) => {
      return sql`SELECT 1`.execute(tx); // it MUST USE `tx` as the database connection instead of `db` or `db2`
    });
  ```

- Via unit of work, it is not possible to configure the database transaction isolation level
  - The database transaction isolation level is defined in `DatabaseUnitOfWork` as "READ COMMITTED" because it is the default for PostgreSQL
  - Reason: The `UnitOfWorkPort` abstraction does not leak operations from the persistence layer adapter, therefore it does not provide a means to define the transaction isolation level
  - Solution: In case of needing to change the transaction level from "READ COMMITTED" to another, do:
