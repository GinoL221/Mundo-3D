export type PaymentIntentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface PaymentIntent {
  reference: string;
  status: PaymentIntentStatus;
  redirectUrl?: string | null; // nullable: hosted checkout, no signature change
}

export interface InitiatePaymentInput {
  orderId: number;
  amount: number;
  currency: string;
}

export interface PaymentGatewayPort {
  initiate(input: InitiatePaymentInput): Promise<PaymentIntent>;
  confirm(reference: string): Promise<PaymentIntent>;
  cancel(reference: string): Promise<PaymentIntent>;
}
