export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;

  // Spends the same work a real `compare` would and yields nothing. Callers
  // use it on the path where there is no stored hash to compare against — an
  // unknown email — so that path costs what a known one costs.
  //
  // It returns void rather than `false` on purpose: there is no comparison to
  // report, only work to spend, and a boolean would invite a caller to branch
  // on a result that is never anything else.
  //
  // The decoy and its cost factor are the adapter's business; an adapter that
  // made this cheaper than `compare` would satisfy the signature and reopen
  // the timing oracle it exists to close.
  compareAgainstDecoy(plain: string): Promise<void>;
}
