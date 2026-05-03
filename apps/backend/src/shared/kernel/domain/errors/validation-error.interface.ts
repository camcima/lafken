export abstract class ValidationError extends Error {
  public readonly errorCode: string;
  public readonly params?: Record<string, unknown>;

  constructor(props: { message: string; params?: Record<string, unknown> }) {
    super(props.message);
    this.name = this.constructor.name;
    this.errorCode = this.constructor.name;
    this.params = props.params;
  }
}
