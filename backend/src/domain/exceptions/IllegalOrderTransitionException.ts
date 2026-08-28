export class IllegalOrderTransitionException extends Error {
  status = 409;
  statusCode = 409;
  constructor(message: string = 'Illegal order status transition') {
    super(message);
    this.name = 'IllegalOrderTransitionException';
    Object.setPrototypeOf(this, IllegalOrderTransitionException.prototype);
  }
}
