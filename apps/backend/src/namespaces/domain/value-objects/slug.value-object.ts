import { InvalidSlugError } from "../errors/invalid-slug.error";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 64;

export class Slug {
  public readonly value: string;

  constructor(input: string) {
    if (typeof input !== "string" || input.length === 0 || input.length > MAX_LENGTH) {
      throw new InvalidSlugError({
        input,
        reason: `must be a non-empty string of at most ${MAX_LENGTH} characters`,
      });
    }
    if (!SLUG_PATTERN.test(input)) {
      throw new InvalidSlugError({
        input,
        reason: "must be lowercase letters, digits, and single dashes",
      });
    }
    this.value = input;
  }

  equals(other: Slug): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
