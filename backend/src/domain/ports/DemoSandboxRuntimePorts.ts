export interface DemoSandboxClockPort {
  now(): Date;
}

export interface DemoSandboxLeaseIdGeneratorPort {
  next(): string;
}

export interface DemoSandboxResetAttemptIdGeneratorPort {
  next(): string;
}
