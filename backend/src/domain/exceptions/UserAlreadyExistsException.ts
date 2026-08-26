export class UserAlreadyExistsException extends Error {
  constructor(message: string = 'User already exists', options?: ErrorOptions) {
    super(message, options);
    this.name = 'UserAlreadyExistsException';
    Object.setPrototypeOf(this, UserAlreadyExistsException.prototype);
  }
}
