(() => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navMenu = document.querySelector('[data-nav-menu]');

  const closeNav = () => {
    if (!navMenu || !navToggle) return;
    navMenu.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Открыть меню');
    document.body.classList.remove('nav-open');
  };

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const open = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      document.body.classList.toggle('nav-open', open);
    });

    navMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNav();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1180) closeNav();
    });
  }

  if (header) {
    const syncHeader = () => header.classList.toggle('scrolled', window.scrollY > 12);
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetSelector = link.getAttribute('href');
      if (!targetSelector || targetSelector === '#') return;
      const target = document.querySelector(targetSelector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const bookingForm = document.querySelector('[data-booking-form]');
  if (!bookingForm) return;

  const phone = bookingForm.querySelector('input[type="tel"]');
  const date = bookingForm.querySelector('input[type="date"]');
  const service = bookingForm.querySelector('select[name="service"]');
  const submit = bookingForm.querySelector('button[type="submit"]');
  const success = bookingForm.querySelector('[data-form-success]');
  const error = bookingForm.querySelector('[data-form-error]');

  const localDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (date) {
    date.min = localDate();
    date.addEventListener('input', () => {
      date.setCustomValidity(!date.value || date.value >= date.min ? '' : 'Выберите сегодняшнюю или будущую дату.');
    });
  }

  if (service) {
    const requested = new URLSearchParams(window.location.search).get('service');
    if (requested && Array.from(service.options).some((option) => option.value === requested)) service.value = requested;
  }

  const validatePhone = () => {
    if (!phone) return true;
    let digits = phone.value.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    const valid = digits.length === 11 && digits.startsWith('7');
    phone.setCustomValidity(valid ? '' : 'Введите российский номер из 11 цифр.');
    return valid;
  };

  if (phone) {
    phone.addEventListener('input', () => {
      let digits = phone.value.replace(/\D/g, '');
      if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
      if (digits && !digits.startsWith('7')) digits = `7${digits}`;
      digits = digits.slice(0, 11);
      const groups = digits.match(/(\d)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
      if (groups) {
        phone.value = `+${groups[1]}${groups[2] ? ` (${groups[2]}` : ''}${groups[2]?.length === 3 ? ')' : ''}${groups[3] ? ` ${groups[3]}` : ''}${groups[4] ? `-${groups[4]}` : ''}${groups[5] ? `-${groups[5]}` : ''}`;
      }
      validatePhone();
    });
  }

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (success) success.className = 'form-status';
    if (error) error.className = 'form-status';
    validatePhone();
    if (!bookingForm.reportValidity()) return;

    const initialText = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Отправляем…';
    }

    try {
      const response = await fetch(bookingForm.action, {
        method: 'POST',
        body: new FormData(bookingForm),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Form endpoint returned ${response.status}`);
      bookingForm.reset();
      if (date) date.min = localDate();
      if (success) success.className = 'form-status success';
    } catch (_) {
      if (error) error.className = 'form-status error';
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = initialText;
      }
    }
  });
})();
