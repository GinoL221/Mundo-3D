import { ClockPort } from '../../domain/ports/ClockPort';
import { EmailConfirmationRateLimitPort } from '../../domain/ports/EmailConfirmationRateLimitPort';

const HOUR_MS = 60 * 60 * 1000;
const MINIMUM_INTERVAL_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 3;

type LimiterOptions = Pick<ClockPort, 'now'>;

export class EmailConfirmationAccountLimiter implements EmailConfirmationRateLimitPort {
  private readonly reservations = new Map<string, number[]>();

  constructor(private readonly clock: LimiterOptions) {}

  reserve(normalizedEmail: string): boolean {
    const now = this.clock.now().getTime();
    const recent = (this.reservations.get(normalizedEmail) ?? []).filter(
      (reservedAt) => now - reservedAt < HOUR_MS,
    );
    const lastReservation = recent.at(-1);

    if (
      recent.length >= MAX_SENDS_PER_HOUR ||
      (lastReservation !== undefined && now - lastReservation < MINIMUM_INTERVAL_MS)
    ) {
      this.reservations.set(normalizedEmail, recent);
      return false;
    }

    recent.push(now);
    this.reservations.set(normalizedEmail, recent);
    return true;
  }

  release(normalizedEmail: string): void {
    const recent = this.reservations.get(normalizedEmail);
    if (!recent) return;

    recent.shift();
    if (recent.length === 0) this.reservations.delete(normalizedEmail);
  }
}
