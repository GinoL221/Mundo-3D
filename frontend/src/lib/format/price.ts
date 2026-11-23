const priceFormatter = new Intl.NumberFormat('es-AR');

export function formatPrice(amount: number): string {
  return `$ ${priceFormatter.format(amount)}`;
}
