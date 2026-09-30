import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mailpitUrl = 'http://localhost:8025/api/v1';
const mailpitHealthUrl = 'http://localhost:8025';
const mailpitStartupTimeoutMs = 10_000;
const mailpitPollIntervalMs = 100;

type MessageSummary = { ID: string; To?: Array<{ Address?: string }> };
type MailpitList = { messages?: MessageSummary[] };
type MailpitMessage = { Text?: string; HTML?: string };
type MailpitChaos = Record<string, unknown>;

type ConfirmationState = {
  emailVerifiedAt: Date | null;
  consumedAt: Date | null;
};

function testDb() {
  require('../../backend/node_modules/dotenv').config({
    path: new URL('../../backend/.env', import.meta.url),
  });
  process.env.NODE_ENV = 'test';
  const { initializeModels } = require('../../backend/src/database/models/index.js');
  return initializeModels();
}

function runCompose(...args: string[]): void {
  execFileSync('docker', ['compose', ...args], { stdio: 'inherit' });
}

async function waitForMailpit(): Promise<void> {
  const deadline = Date.now() + mailpitStartupTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(mailpitHealthUrl);
      if (response.ok) return;
    } catch {
      // Mailpit may still be binding its HTTP API after Docker reports it started.
    }
    await new Promise((resolve) => setTimeout(resolve, mailpitPollIntervalMs));
  }

  throw new Error('Mailpit did not become ready before the E2E startup timeout');
}

async function getMailpitChaos(): Promise<MailpitChaos> {
  const response = await fetch(`${mailpitUrl}/chaos`);
  if (!response.ok) throw new Error(`Mailpit chaos read failed: ${response.status}`);
  return (await response.json()) as MailpitChaos;
}

async function putMailpitChaos(config: MailpitChaos): Promise<void> {
  const response = await fetch(`${mailpitUrl}/chaos`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error(`Mailpit chaos update failed: ${response.status}`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function applyMailpitChaos(config: MailpitChaos): Promise<MailpitChaos> {
  await putMailpitChaos(config);
  return getMailpitChaos();
}

export async function startMailpit(): Promise<void> {
  runCompose('up', '-d', 'mailpit');
  await waitForMailpit();
  const defaults = await applyMailpitChaos({});
  const expectedDefaults = {
    Sender: { ErrorCode: 451, Probability: 0 },
    Recipient: { ErrorCode: 451, Probability: 0 },
    Authentication: { ErrorCode: 535, Probability: 0 },
  };
  for (const [kind, expected] of Object.entries(expectedDefaults)) {
    const actual = defaults[kind] as { ErrorCode?: number; Probability?: number } | undefined;
    if (actual?.ErrorCode !== expected.ErrorCode || actual.Probability !== expected.Probability) {
      throw new Error(`Mailpit did not reset ${kind} chaos to defaults: ${JSON.stringify(defaults)}`);
    }
  }
  if (stableJson(defaults) !== stableJson(await getMailpitChaos())) {
    throw new Error('Mailpit default chaos configuration readback was inconsistent');
  }
}

export async function clearMailpit(): Promise<void> {
  const response = await fetch(`${mailpitUrl}/messages`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Mailpit reset failed: ${response.status}`);
}

export async function withMailpitRejectingSmtp<T>(action: () => Promise<T>): Promise<T> {
  const previous = await getMailpitChaos();
  try {
    const rejecting = await applyMailpitChaos({ Sender: { ErrorCode: 451, Probability: 100 } });
    if (stableJson(rejecting.Sender) !== stableJson({ ErrorCode: 451, Probability: 100 })) {
      throw new Error(`Mailpit SMTP rejection readback mismatch: ${JSON.stringify(rejecting)}`);
    }
    return await action();
  } finally {
    const restored = await applyMailpitChaos(previous);
    if (stableJson(restored) !== stableJson(previous)) {
      throw new Error(`Mailpit chaos restore readback mismatch: ${JSON.stringify(restored)}`);
    }
  }
}

export async function expectNoAcceptedMailpitMessage(email: string): Promise<void> {
  const response = await fetch(`${mailpitUrl}/messages`);
  if (!response.ok) throw new Error(`Mailpit message list failed: ${response.status}`);
  const messages = ((await response.json()) as MailpitList).messages ?? [];
  if (messages.some((candidate) => candidate.To?.some((recipient) => recipient.Address === email))) {
    throw new Error(`Mailpit unexpectedly accepted a message for ${email}`);
  }
}

export async function confirmationLinkAcceptedByLocalMailpit(email: string): Promise<string> {
  const response = await fetch(`${mailpitUrl}/messages`);
  if (!response.ok) throw new Error(`Mailpit message list failed: ${response.status}`);
  const message = ((await response.json()) as MailpitList).messages?.find((candidate) =>
    candidate.To?.some((recipient) => recipient.Address === email),
  );
  if (!message) throw new Error('Mailpit has no accepted local SMTP message for this registration');

  const content = await fetch(`${mailpitUrl}/message/${message.ID}`);
  if (!content.ok) throw new Error(`Mailpit message read failed: ${content.status}`);
  const body = (await content.json()) as MailpitMessage;
  const link = `${body.Text ?? ''}\n${body.HTML ?? ''}`.match(
    /http:\/\/localhost:4322\/confirm-email\?token=[^\s"<]+/i,
  )?.[0];
  if (!link) throw new Error('Mailpit message does not contain a local confirmation link');
  return link;
}

async function readConfirmationRecord(email: string) {
  const db = testDb();
  const user = await db.User.findOne({ where: { email } });
  if (!user) throw new Error(`Missing registered user: ${email}`);
  const token = await db.EmailConfirmationToken.findOne({
    where: { idUser: user.idUser },
    order: [['createdAt', 'DESC']],
  });
  return { user, token };
}

export async function readConfirmationState(email: string): Promise<ConfirmationState> {
  const { user, token } = await readConfirmationRecord(email);
  return {
    emailVerifiedAt: user.emailVerifiedAt,
    consumedAt: token?.consumedAt ?? null,
  };
}

export async function readRegistrationConfirmationState(
  email: string,
): Promise<ConfirmationState & { activeSlot: number | null }> {
  const { user, token } = await readConfirmationRecord(email);
  return {
    emailVerifiedAt: user.emailVerifiedAt,
    consumedAt: token?.consumedAt ?? null,
    activeSlot: token?.activeSlot ?? null,
  };
}
