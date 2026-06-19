try {
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const strengthChecksContainer = document.getElementById('password-strength-checks');

  const checkUppercase = document.getElementById('check-uppercase');
  const checkNumber = document.getElementById('check-number');
  const checkSpecial = document.getElementById('check-special');
  const checkMatch = document.getElementById('check-match');

  let confirmTouched = false;

  function setCheck(el, valid) {
    if (!el) return;
    const icon = el.querySelector('.icon');
    el.style.color = valid ? '#34a853' : '#ea4335';
    if (icon) icon.textContent = valid ? '✔' : '✘';
  }

  function updateChecks() {
    if (!passwordInput || !confirmPasswordInput) return;

    const password = passwordInput.value || '';
    const confirmPassword = confirmPasswordInput.value || '';

    // Show/hide strength checks container
    if (strengthChecksContainer) {
      strengthChecksContainer.style.display = password.length > 0 ? 'block' : 'none';
    }

    setCheck(checkUppercase, /[A-Z]/.test(password));
    setCheck(checkNumber,    /[0-9]/.test(password));
    setCheck(checkSpecial,   /[^A-Za-z0-9]/.test(password));

    // Match check: only show after user touches confirm field
    if (checkMatch) {
      if (!confirmTouched) {
        checkMatch.style.display = 'none';
      } else {
        checkMatch.style.display = 'flex';
        const isMatch = password.length > 0 && password === confirmPassword;
        setCheck(checkMatch, isMatch);
      }
    }
  }

  if (passwordInput && confirmPasswordInput) {
    passwordInput.addEventListener('input', updateChecks);
    passwordInput.addEventListener('change', updateChecks);

    confirmPasswordInput.addEventListener('input', () => {
      confirmTouched = true;
      updateChecks();
    });
    confirmPasswordInput.addEventListener('change', () => {
      confirmTouched = true;
      updateChecks();
    });

    // Catch autofill
    updateChecks();
    setTimeout(updateChecks, 100);
    setTimeout(updateChecks, 500);
    setTimeout(updateChecks, 1000);
  }
} catch (err) {
  console.error('Error running password checks script:', err);
}
