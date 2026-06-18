export class CartValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartValidationException';
    Object.setPrototypeOf(this, CartValidationException.prototype);
  }
}
