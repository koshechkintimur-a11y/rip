import nodemailer from 'nodemailer';

/**
 * Отправка писем через SMTP (env: SMTP_HOST/PORT/USER/PASS/FROM).
 * Без SMTP — dev-режим: письмо логируется, возвращается код сброса (для локального теста).
 */
export async function sendMail(to: string, subject: string, html: string): Promise<{ sent: boolean; devCode?: string }> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // dev-режим: извлекаем код из ссылки и логируем
    const m = html.match(/code=([a-f0-9]{64})/i);
    const devCode = m ? m[1] : undefined;
    console.log('[mail:dev]', subject, '→', to, devCode ? `code=${devCode}` : '(без кода)');
    return { sent: false, devCode };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@rip.demo',
    to,
    subject,
    html,
  });
  return { sent: true };
}
