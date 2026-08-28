export class EmptyCartException extends Error {
  status = 409;
  statusCode = 409;
  constructor(message: string = 'The active cart is empty') {
    super(message);
    this.name = 'EmptyCartException';
    Object.setPrototypeOf(this, EmptyCartException.prototype);
  }
}
