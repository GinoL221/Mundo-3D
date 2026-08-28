// Thrown by an OrderRepositoryPort adapter when `createWithItems` hits the
// `UNIQUE (id_user, idempotency_key)` violation. The use case catches this
// outside the transaction and replays the already-committed order instead.
export class DuplicateIdempotencyKeyException extends Error {
  status = 409;
  statusCode = 409;
  constructor(message: string = 'An order already exists for this idempotency key') {
    super(message);
    this.name = 'DuplicateIdempotencyKeyException';
    Object.setPrototypeOf(this, DuplicateIdempotencyKeyException.prototype);
  }
}
