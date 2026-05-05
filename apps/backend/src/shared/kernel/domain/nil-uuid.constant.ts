/**
 * RFC 4122 nil UUID. Used as a sentinel during transactions where a
 * deferrable FK must be satisfied by COMMIT but the real referenced row
 * doesn't exist yet (see NamespaceWriteRepository.createWithInitialPolicy).
 * Never collides with a real uuidv7() output.
 */
export const NIL_UUID = "00000000-0000-0000-0000-000000000000";
