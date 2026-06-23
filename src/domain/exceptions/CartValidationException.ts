export class CartValidationException extends Error {
  status = 400;
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'CartValidationException';
    Object.setPrototypeOf(this, CartValidationException.prototype);
  }
}
