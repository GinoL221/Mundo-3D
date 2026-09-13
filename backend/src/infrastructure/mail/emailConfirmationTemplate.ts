export interface EmailConfirmationTemplate {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export function renderEmailConfirmationTemplate({
  confirmationUrl,
}: {
  confirmationUrl: string;
  expiresAt: Date;
}): EmailConfirmationTemplate {
  const subject = 'Confirma tu correo electrónico';
  const text = `${subject}\n\nConfirma tu correo electrónico abriendo este enlace:\n${confirmationUrl}\n\nEl enlace vence en 24 horas.`;
  const html = `<p>${subject}</p><p>Confirma tu correo electrónico abriendo este enlace:</p><p><a href="${escapeHtml(confirmationUrl)}">Confirmar correo electrónico</a></p><p>El enlace vence en 24 horas.</p>`;

  return { subject, text, html };
}
