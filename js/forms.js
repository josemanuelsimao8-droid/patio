function formValues(form) {
	return Object.fromEntries(new FormData(form).entries());
}

function validateForm(form) {
	form.querySelectorAll('.error').forEach((el) => el.remove());
	let valid = true;
	[...form.elements].forEach((field) => {
		if (!field.name || field.disabled) return;
		field.setAttribute('aria-invalid', 'false');
		if (!field.checkValidity()) {
			valid = false;
			field.setAttribute('aria-invalid', 'true');
			const note = document.createElement('span');
			note.className = 'error';
			note.textContent = field.validationMessage;
			field.parentElement.appendChild(note);
		}
	});
	return valid;
}

function reservaMessage(data) {
	return `Olá, Pátio Luanda.

Gostaria de fazer uma reserva.

Nome: ${data.name}
Data: ${data.date}
Hora: ${data.time}
Pessoas: ${data.people}
Espaço: ${data.space}

Observações:
${data.notes || '—'}`;
}

function eventoMessage(data) {
	return `Olá, Pátio Luanda. Gostaria de informações sobre eventos.

Nome: ${data.name}
Empresa: ${data.company || '—'}
Tipo de evento: ${data.type}
Data: ${data.date}
Convidados: ${data.guests}
Espaço: ${data.space}
Contacto: ${data.contact}

Observações:
${data.notes || '—'}`;
}

document.querySelectorAll('[data-reservation-form]').forEach((form) => {
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!validateForm(form)) return;
		const data = formValues(form);
		const message = reservaMessage(data);
		const status = form.parentElement.querySelector('[data-reserva-status]') || document.querySelector('[data-reserva-status]');
		if (status) {
			status.classList.remove('hidden');
			status.innerHTML = `<strong>Pedido preparado.</strong><p>Resumo: ${data.name}, ${data.people} pessoas, ${data.space}, ${data.date} às ${data.time}.</p><a class="btn" href="${patioWhatsAppUrl(message)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>`;
		}
		window.open(patioWhatsAppUrl(message), '_blank', 'noopener');
	});
});

const eventForm = document.querySelector('[data-event-form]');
if (eventForm) {
	eventForm.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!validateForm(eventForm)) return;
		const data = formValues(eventForm);
		const message = eventoMessage(data);
		const status = document.querySelector('[data-event-status]');
		status.classList.remove('hidden');
		status.innerHTML = `<strong>Proposta pedida.</strong><p>Vamos receber o seu pedido de ${data.type} para ${data.space}.</p><a class="btn" href="${patioWhatsAppUrl(message)}" target="_blank" rel="noopener">Continuar no WhatsApp</a>`;
		window.open(patioWhatsAppUrl(message), '_blank', 'noopener');
	});
}

const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
	contactForm.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!validateForm(contactForm)) return;
		const data = formValues(contactForm);
		const message = `Olá, Pátio Luanda. Gostaria de obter mais informações.

Nome: ${data.name}
Contacto: ${data.phone}
Assunto: ${data.subject}
Mensagem: ${data.message}`;
		document.querySelector('[data-contact-status]').classList.remove('hidden');
		window.open(patioWhatsAppUrl(message), '_blank', 'noopener');
	});
}
