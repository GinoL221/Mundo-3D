// Reference model only: the atomic transitions below assume storage enforcement.
// This is not a database adapter or a synchronization primitive.
type Operation = symbol;

export class FenceModel {
  private lease = 'lease-1';
  private generation = 0;
  private state: 'open' | 'fenced' | 'verified' = 'open';
  private attempt = '';
  private readonly active = new Set<Operation>();
  private readonly attempts = new Set<string>();
  private readonly leases = new Set<string>(['lease-1']);
  private data: string[] = [];

  begin(lease: string, generation: number): Operation | null {
    if (this.state !== 'open' || lease !== this.lease || generation !== this.generation) return null;
    const operation = Symbol('operation');
    this.active.add(operation);
    return operation;
  }

  write(operation: Operation, value: string): boolean {
    if (!this.active.has(operation) || this.state !== 'open') return false;
    this.data.push(value);
    return true;
  }

  finish(operation: Operation): void {
    this.active.delete(operation);
  }

  fence(attempt: string): boolean {
    if (this.state !== 'open' || !attempt || this.attempts.has(attempt) || this.active.size !== 0) return false;
    this.attempts.add(attempt);
    this.attempt = attempt;
    this.state = 'fenced';
    return true;
  }

  recover(expected: string, next: string, previousWorkerStopped: boolean): boolean {
    if (this.state === 'open' || this.attempt !== expected || !next || this.attempts.has(next) || !previousWorkerStopped) return false;
    this.attempts.add(next);
    this.attempt = next;
    this.state = 'fenced';
    return true;
  }

  reset(attempt: string): boolean {
    if (this.state !== 'fenced' || attempt !== this.attempt) return false;
    this.data = [];
    this.state = 'verified';
    return true;
  }

  activate(attempt: string, lease: string, generation: number): boolean {
    if (this.state !== 'verified' || this.attempt !== attempt || !lease || this.leases.has(lease) || generation !== this.generation + 1) return false;
    this.leases.add(lease);
    this.generation = generation;
    this.lease = lease;
    this.state = 'open';
    return true;
  }

  values(): string[] {
    return [...this.data];
  }
}
