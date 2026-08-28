import { randomBytes } from 'crypto';
import { PaymentGatewayPort, PaymentIntent, InitiatePaymentInput } from '../../domain/ports/PaymentGatewayPort';

// No real payment processor exists yet (proposal's already-resolved
// decision). `initiate` synchronously mints a reference and reports
// `PENDING` — zero network I/O, so it never holds InnoDB row locks even
// though `CreateOrderUseCase` calls it post-commit anyway. `confirm`/`cancel`
// simply round-trip the same reference through the requested terminal
// status; there is nothing external to reconcile against.
export class ManualPaymentGateway implements PaymentGatewayPort {
  async initiate(input: InitiatePaymentInput): Promise<PaymentIntent> {
    const reference = `MANUAL-${input.orderId}-${randomBytes(4).toString('hex')}`;
    return { reference, status: 'PENDING', redirectUrl: null };
  }

  async confirm(reference: string): Promise<PaymentIntent> {
    return { reference, status: 'CONFIRMED' };
  }

  async cancel(reference: string): Promise<PaymentIntent> {
    return { reference, status: 'CANCELLED' };
  }
}
