import nodemailer, { type Transporter } from 'nodemailer';

export interface Mail { to: string; subject: string; text: string }

/**
 * Sent mail is kept here (newest last, up to 100) when no SMTP server is configured, so a local install
 * and the tests can read the links that would have been emailed.
 */
export const outbox: Mail[] = [];

let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  if (!host) return (transport = null);
  const port = Number(process.env.SMTP_PORT ?? 587);
  transport = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  const t = getTransport();
  if (!t) {
    outbox.push(mail);
    if (outbox.length > 100) outbox.shift();
    if (process.env.NODE_ENV !== 'test') console.log(`[mail, not sent: no SMTP configured] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM || 'Voidspace <noreply@localhost>', to: mail.to, subject: mail.subject, text: mail.text });
}

/** Where links in emails point: the first configured front-end address. */
export function webUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
}
