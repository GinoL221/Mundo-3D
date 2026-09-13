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

export async function startMailpit(): Promise<void> {
  runCompose('up', '-d', 'mailpit');
  await waitForMailpit();
}

function stopMailpit(): void {
  runCompose('stop', 'mailpit');
}

export async function clearMailpit(): Promise<void> {
  const response = await fetch(`${mailpitUrl}/messages`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Mailpit reset failed: ${response.status}`);
}

export async function withMailpitUnavailable<T>(action: () => Promise<T>): Promise<T> {
  stopMailpit();
  try {
    return await action();
  } finally {
    await startMailpit();
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
