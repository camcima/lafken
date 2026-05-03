export interface PaginatedResult<T> {
  /** The items in the current page. */
  data: T[];
  /** The number of items per page. */
  limit: number;
  /** The total number of items. */
  total: number;
  /** The current page number. */
  page: number;
  /** The last page number. */
  lastPage: number;
}
