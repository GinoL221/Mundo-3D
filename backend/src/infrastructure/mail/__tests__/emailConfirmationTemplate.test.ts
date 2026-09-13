const { renderEmailConfirmationTemplate } = require('../emailConfirmationTemplate') as {
  renderEmailConfirmationTemplate: (input: { confirmationUrl: string; expiresAt: Date }) => {
    subject: string;
    text: string;
    html: string;
  };
};

describe('renderEmailConfirmationTemplate', () => {
  it('renders Spanish confirmation copy and escapes interpolated URL content in HTML', () => {
    const template = renderEmailConfirmationTemplate({
      confirmationUrl: 'https://shop.example.com/confirm-email?token=<script>alert(1)</script>',
      expiresAt: new Date('2026-09-05T12:00:00.000Z'),
    });

    expect(template.subject).toBe('Confirma tu correo electrónico');
    expect(template.text).toContain('Confirma tu correo electrónico');
    expect(template.text).toContain(
      'https://shop.example.com/confirm-email?token=<script>alert(1)</script>',
    );
    expect(template.html).toContain('Confirma tu correo electrónico');
    expect(template.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(template.html).not.toContain('<script>alert(1)</script>');
  });

  it('states the configured expiry in Spanish without adding account or delivery claims', () => {
    const template = renderEmailConfirmationTemplate({
      confirmationUrl: 'https://shop.example.com/confirm-email?token=opaque-token',
      expiresAt: new Date('2026-09-05T12:00:00.000Z'),
    });

    expect(template.text).toContain('24 horas');
    expect(template.html).toContain('24 horas');
    expect(template.text).not.toMatch(/entregado|bandeja de entrada/i);
  });
});
