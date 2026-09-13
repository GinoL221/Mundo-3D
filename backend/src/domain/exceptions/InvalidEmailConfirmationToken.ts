export class InvalidEmailConfirmationToken extends Error {
  constructor(message: string = 'Invalid email confirmation token', options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidEmailConfirmationToken';
    Object.setPrototypeOf(this, InvalidEmailConfirmationToken.prototype);
  }
}
