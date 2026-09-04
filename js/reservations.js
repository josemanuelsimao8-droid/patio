const reservationForm = document.querySelector('[data-reservation-form]');

if (reservationForm) {
	const type = reservationForm.querySelector('[name="type"]');
	const eventFields = reservationForm.querySelector('[data-event-fields]');
	const guestLabel = reservationForm.querySelector('[data-guest-label]');

	const updateFields = () => {
		const isEvent = type.value === 'event';
		eventFields.classList.toggle('hidden', !isEvent);
		eventFields.querySelectorAll('input').forEach((input) => {
			input.required = isEvent;
		});
		guestLabel.textContent = isEvent ? 'Número de convidados' : 'Pessoas';
	};

	type.addEventListener('change', updateFields);
	updateFields();

	reservationForm.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!reservationForm.checkValidity()) {
			reservationForm.reportValidity();
			return;
		}
		document.querySelector('[data-form-status]').classList.remove('hidden');
		reservationForm.reset();
		updateFields();
	});
}

const contactForm = document.querySelector('[data-contact-form]');

if (contactForm) {
	contactForm.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!contactForm.checkValidity()) {
			contactForm.reportValidity();
			return;
		}
		document.querySelector('[data-contact-status]').classList.remove('hidden');
		contactForm.reset();
	});
}
