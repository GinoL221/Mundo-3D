import type { SandboxReleaseIdentity } from './AuthoritativeReleaseStateReaderPort';

/**
 * The durable identity of the connection that attempted a release, recorded
 * BEFORE the release transaction starts on a dedicated connection, so the
 * record survives that transaction's rollback and can prove the recorded
 * connection's identity even when the release did not commit.
 */
export interface RecordedReleaseSession {
  readonly attemptId: string;
  readonly slotId: string;
  readonly generation: number;
  readonly serverUuid: string;
  readonly connectionId: string;
}

/**
 * Writes the release session record. The adapter must capture CONNECTION_ID()
 * and @@server_uuid on the same connection that will run the release
 * transaction, insert parameterized values only, and map an attempt-session
 * uniqueness rejection to its domain exception. Storage enforcement, grants and
 * retention are the adapter's and operator's responsibility; nothing here
 * proves any of it.
 */
export interface SandboxReleaseSessionRecorderPort {
  recordSession(identity: SandboxReleaseIdentity): Promise<RecordedReleaseSession>;
}
