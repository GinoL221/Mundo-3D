export function bindPasswordToggles(root: ParentNode): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>('button[data-password-toggle]');
  for (const button of buttons) {
    const targetId = button.getAttribute('aria-controls');
    if (!targetId) continue;
    const input = document.getElementById(targetId) as HTMLInputElement | null;
    if (!input) continue;

    const showIcon = button.querySelector<SVGElement>('[data-icon="show"]');
    const hideIcon = button.querySelector<SVGElement>('[data-icon="hide"]');

    button.addEventListener('click', () => {
      const nextVisible = input.type === 'password';
      input.type = nextVisible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(nextVisible));
      button.setAttribute('aria-label', nextVisible ? 'Ocultar contraseña' : 'Mostrar contraseña');
      showIcon?.classList.toggle('hidden', nextVisible);
      hideIcon?.classList.toggle('hidden', !nextVisible);
    });
  }
}
