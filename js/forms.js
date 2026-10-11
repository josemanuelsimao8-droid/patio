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
Email: ${data.email || '—'}

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
		const link = document.createElement('a');
		link.className = 'btn';
		link.href = patioWhatsAppUrl(message);
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = 'Enviar pedido pelo WhatsApp';
		status.replaceChildren(
			Object.assign(document.createElement('strong'), { textContent: 'Pedido preparado.' }),
			document.createTextNode(' No WhatsApp, reveja a mensagem e toque em Enviar para a equipa comercial receber o seu pedido.'),
			link,
		);
		status.classList.remove('hidden');
		window.open(link.href, '_blank', 'noopener');
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
E-mail: ${data.email || '—'}
Assunto: ${data.subject}
Mensagem: ${data.message}`;
		const status = document.querySelector('[data-contact-status]');
		const link = document.createElement('a');
		link.className = 'btn';
		link.href = patioWhatsAppUrl(message);
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = 'Abrir WhatsApp novamente';
		status.replaceChildren(
			document.createTextNode('A mensagem está pronta. No WhatsApp, toque em Enviar para a equipa a receber. '),
			link,
		);
		status.classList.remove('hidden');
		window.open(link.href, '_blank', 'noopener');
	});
}

const feedbackForm = document.querySelector('[data-feedback-form]');
if (feedbackForm) {
	feedbackForm.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!validateForm(feedbackForm)) return;
		const data = formValues(feedbackForm);
		const message = `Olá, Grupo Pátio. Gostaria de partilhar a minha experiência.\n\nEspaço ou serviço: ${data.space}\nAtendimento: ${data.service_rating}/5\nComida: ${data.food_rating}/5\nAmbiente: ${data.atmosphere_rating}/5\n\nO que gostaria de ver melhorado?\n${data.improvements || 'Sem resposta'}\n\nSugestão adicional\n${data.suggestion || 'Sem resposta'}`;
		const status = document.querySelector('[data-feedback-status]');
		const link = document.createElement('a');
		link.className = 'text-link';
		link.href = patioWhatsAppUrl(message);
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = 'Abrir WhatsApp novamente';
		status.replaceChildren(
			document.createTextNode('As suas respostas estão prontas. No WhatsApp, toque em Enviar para partilhá-las com o Grupo Pátio. '),
			link,
		);
		status.classList.remove('hidden');
		window.open(link.href, '_blank', 'noopener');
	});
}
