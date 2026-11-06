// Reference model only: each method assumes atomic, durable, serialized storage.
// It does not implement locks, crashes, reset effects, or a real receipt store.
interface Identity {
  slot: string;
  generation: number;
  attempt: string;
  version: string;
}

function matches(left: Identity, right: Identity): boolean {
  return (
    left.slot === right.slot &&
    left.generation === right.generation &&
    left.attempt === right.attempt &&
    left.version === right.version
  );
}

export class ReceiptModel {
  private readonly current: Identity;
  private receipt: Identity | null = null;
  private consumed = false;
  private resetEffects = 0;

  constructor(identity: Identity) {
    this.current = { ...identity };
  }

  reset(identity: Identity): boolean {
    if (!matches(this.current, identity) || this.receipt !== null) return false;
    this.resetEffects += 1;
    this.receipt = { ...identity };
    return true;
  }

  release(identity: Identity): boolean {
    if (!matches(this.current, identity) || !this.receipt || this.consumed) return false;
    if (!matches(this.receipt, identity)) return false;
    this.consumed = true;
    return true;
  }

  effects(): number {
    return this.resetEffects;
  }
}
