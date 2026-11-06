// Specification model only. Each transition assumes durable atomic storage and
// serialization that the current application does not implement.
export class ActivationModel {
  private control: 'closed' | 'reserved' | 'active' | 'quarantined' = 'closed';
  private slot: 'fenced' | 'prepared' | 'open' = 'fenced';
  private lease: string | null = null;
  private interrupted = false;

  reserve(lease: string): boolean {
    if (this.interrupted || this.control !== 'closed' || this.slot !== 'fenced' || !lease) return false;
    this.control = 'reserved';
    this.lease = lease;
    return true;
  }

  prepare(lease: string): boolean {
    if (this.interrupted || this.control !== 'reserved' || this.slot !== 'fenced' || this.lease !== lease) return false;
    this.slot = 'prepared';
    return true;
  }

  publish(lease: string): boolean {
    if (this.interrupted || this.control !== 'reserved' || this.slot !== 'prepared' || this.lease !== lease) return false;
    this.control = 'active';
    return true;
  }

  open(lease: string): boolean {
    if (this.interrupted || this.control !== 'active' || this.slot !== 'prepared' || this.lease !== lease) return false;
    this.slot = 'open';
    return true;
  }

  admit(lease: string): boolean {
    return !this.interrupted && this.control === 'active' && this.slot === 'open' && this.lease === lease;
  }

  interrupt(): void {
    this.interrupted = true;
  }

  reconcile(previousWorkerStopped: boolean): boolean {
    if (!this.interrupted || !previousWorkerStopped) return false;
    // Abstracts an exclusive storage fence that waits for in-flight transactions.
    this.slot = 'fenced';
    this.control = 'quarantined';
    this.interrupted = false;
    return true;
  }
}
