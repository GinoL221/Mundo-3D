export class SelectedProductNotFoundException extends Error {
  constructor() {
    super('Selected product not found');
    this.name = 'SelectedProductNotFoundException';
  }
}
