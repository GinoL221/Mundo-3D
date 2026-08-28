export class OrderValidationException extends Error {
  status = 400;
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'OrderValidationException';
    Object.setPrototypeOf(this, OrderValidationException.prototype);
  }
}
