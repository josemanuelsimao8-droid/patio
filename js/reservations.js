const reservationForm = document.querySelector('[data-reservation-form]');

if (reservationForm) {
  const type = reservationForm.querySelector('[name="type"]');
  const eventFields = reservationForm.querySelector('[data-event-fields]');
  const guestLabel = reservationForm.querySelector('[data-guest-label]');
  const status = document.querySelector('[data-form-status]');
  const submitButton = reservationForm.querySelector('[type="submit"]');
  const dateField = reservationForm.querySelector('[name="date"]');
  const timeField = reservationForm.querySelector('[name="time"]');
  const guestsField = reservationForm.querySelector('[name="guests"]');
  let isSubmitting = false;

  if (!type || !eventFields || !guestLabel || !status || !submitButton || !dateField || !timeField || !guestsField) {
    throw new Error('O formulário de reservas não contém todos os campos necessários.');
  }

  const localDate = new Date();
  dateField.min = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  guestsField.max = '200';

  const updateFields = () => {
    const isEvent = type.value === 'event';
    eventFields.classList.toggle('hidden', !isEvent);
    eventFields.querySelectorAll('input').forEach((input) => {
      input.required = isEvent;
    });
    guestLabel.textContent = isEvent ? 'Número de convidados' : 'Pessoas';
  };

  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.remove('hidden');
    status.classList.toggle('form-status-error', isError);
  };

  const validDateTime = () => {
    const dateMatch = dateField.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = timeField.value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!dateMatch || !timeMatch) return false;
    const [, year, month, day] = dateMatch.map(Number);
    const date = new Date(year, month - 1, day, Number(timeMatch[1]), Number(timeMatch[2]));
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
      && date > new Date();
  };

  type.addEventListener('change', updateFields);
  updateFields();

  reservationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!reservationForm.checkValidity()) {
      reservationForm.reportValidity();
      return;
    }

    const guests = Number(guestsField.value);
    if (!Number.isInteger(guests) || guests < 1 || guests > 200) {
      showStatus('Indique um número inteiro de pessoas entre 1 e 200.', true);
      guestsField.focus();
      return;
    }
    if (!validDateTime()) {
      showStatus('Escolha uma data e hora válidas no futuro.', true);
      dateField.focus();
      return;
    }

    const formData = new FormData(reservationForm);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      type: String(formData.get('type') || ''),
      space: String(formData.get('space') || ''),
      eventType: String(formData.get('eventType') || '').trim(),
      date: String(formData.get('date') || ''),
      time: String(formData.get('time') || ''),
      guests,
      message: String(formData.get('message') || '').trim(),
    };

    isSubmitting = true;
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'A enviar…';
    showStatus('A enviar o pedido de reserva…');

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(response.ok
          ? 'O servidor respondeu num formato inesperado. O pedido não foi confirmado.'
          : 'O servidor não conseguiu processar o pedido. Tente novamente.');
      }
      let result;
      try {
        result = await response.json();
      } catch (_error) {
        throw new Error('O servidor devolveu uma resposta inválida. Tente novamente.');
      }

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível registar o pedido. Verifique os dados.');
      }
      if (result.ok !== true) {
        throw new Error('O servidor não confirmou o registo do pedido. Tente novamente.');
      }

      showStatus(
        'O seu pedido foi registado. A equipa do Pátio ainda precisa de confirmar a disponibilidade por telefone ou email.'
      );
      reservationForm.reset();
      updateFields();
    } catch (error) {
      showStatus(
        error instanceof TypeError
          ? 'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.'
          : error.message || 'Ocorreu um erro. Verifique a ligação e tente novamente.',
        true
      );
    } finally {
      isSubmitting = false;
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
}
