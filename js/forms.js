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
		const status = document.querySelector('[data-contact-status]');
		const message = `Olá, Pátio Luanda. ${data.subject}\n\nNome: ${data.name}\nTelefone / WhatsApp: ${data.phone}\nE-mail: ${data.email || '—'}\n\n${data.message}`;
		const link = document.createElement('a');
		link.className = 'btn';
		link.href = patioWhatsAppUrl(message);
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = 'Abrir WhatsApp novamente';
		status.replaceChildren(
			document.createTextNode('A mensagem está pronta. No WhatsApp, reveja-a e toque em Enviar para nos contactar. '),
			link,
		);
		status.classList.remove('hidden');
		window.open(link.href, '_blank', 'noopener');
	});
}

const feedbackForm = document.querySelector('[data-feedback-form]');
if (feedbackForm) {
	let submissionToken = crypto.randomUUID();
	feedbackForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!validateForm(feedbackForm)) return;
		const data = formValues(feedbackForm);
		const status = document.querySelector('[data-feedback-status]');
		const button = feedbackForm.querySelector('[type="submit"]');
		button.disabled = true;
		status.textContent = 'A enviar a sua mensagem…';
		status.classList.remove('hidden');
		status.classList.remove('is-error');
		try {
			const tokenResponse = await fetch('/api/csrf-token', { cache: 'no-store' });
			if (!tokenResponse.ok) throw new Error('Não foi possível validar o envio. Atualize a página e tente novamente.');
			const { csrfToken } = await tokenResponse.json();
			const response = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
				body: JSON.stringify({
					name: data.name || '', email: data.email || '', phone: data.phone || '',
					type: data.type, space: data.space, subject: data.subject || '', message: '',
					improvements: data.improvements || '', suggestion: data.suggestion || '',
					answers: {
						service_rating: data.service_rating,
						food_rating: data.food_rating,
						atmosphere_rating: data.atmosphere_rating,
					},
					submissionToken,
				}),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || 'Não foi possível enviar a mensagem. Tente novamente.');
			feedbackForm.reset();
			submissionToken = crypto.randomUUID();
			status.textContent = result.message || 'A sua mensagem foi enviada com sucesso.';
		} catch (error) {
			status.textContent = error instanceof TypeError
				? 'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.'
				: error.message;
			status.classList.add('is-error');
		} finally {
			button.disabled = false;
		}
	});
}
