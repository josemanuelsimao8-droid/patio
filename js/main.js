const NAV = [
	{
		label: 'Descobrir o Pátio',
		href: 'descobrir.html',
		items: [
			['A Nossa História', 'descobrir.html#historia'],
			['A Nossa Cozinha', 'descobrir.html#cozinha'],
			['Galeria', 'galeria.html'],
			['Experiência Pátio', 'descobrir.html#experiencia'],
		],
	},
	{
		label: 'Os nossos espaços',
		href: 'espacos.html',
		items: [
			['Morro Bento', 'morrobento.html'],
			['Mutamba', 'mutamba.html'],
			['Roots', 'roots.html'],
			['Pastelaria Pátio', 'espacos.html#pastelaria'],
			['Pátio Aeroporto', 'espacos.html#aeroporto'],
			['Eventos', 'eventos.html'],
			['Outras áreas e serviços', 'espacos.html#servicos'],
		],
	},
	{
		label: 'Menus',
		href: 'menus.html',
		items: [
			['Menu Roots / Pátio Mutamba', 'menus.html#menu-roots'],
			['Bebidas', 'menus.html#bebidas'],
			['Sobremesas', 'menus.html#sobremesas'],
			['Pastelaria', 'menus.html#pastelaria'],
			['Menu de Sushi', 'menus.html#sushi'],
		],
	},
	{ label: 'Contactos', href: 'contacto.html' },
	{ label: 'Fala Comigo', href: 'fala-comigo.html' },
];

const pageFile = location.pathname.split('/').pop() || 'index.html';

function chevron() {
	return '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
}

function navMarkup() {
	return NAV.map((item) => {
		const active = pageFile === item.href || (item.items || []).some((sub) => sub[1].startsWith(pageFile));
		if (!item.items) {
			return `<li class="nav-item"><a class="nav-link${active ? ' active' : ''}" href="${item.href}"><span>${item.label}</span></a></li>`;
		}
		const subs = item.items.map(([label, href]) => `<a href="${href}">${label}</a>`).join('');
		return `<li class="nav-item">
			<a class="nav-link nav-parent${active ? ' active' : ''}" href="${item.href}" aria-expanded="false"><span>${item.label}</span> ${chevron()}</a>
			<div class="submenu" role="menu">${subs}</div>
		</li>`;
	}).join('');
}

const header = document.querySelector('[data-header]');
if (header) {
	header.innerHTML = `
		<div class="wrap nav">
			<a class="wordmark" href="index.html" aria-label="Pátio Luanda, início">
				<img class="brand-logo" src="assets/logo-white.png" alt="Pátio Luanda" width="148" height="44">
			</a>
			<ul class="nav-links" id="main-nav">${navMarkup()}</ul>
			<div class="nav-actions">
				<a class="nav-cta" href="reservas.html">Reservar mesa</a>
				<div class="lang">
					<button class="lang-btn" type="button" aria-expanded="false" aria-haspopup="listbox">PT ${chevron()}</button>
					<div class="lang-menu" role="listbox">
						<button type="button" aria-selected="true">PT</button>
						<button type="button">EN</button>
					</div>
				</div>
				<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menu">
					<span></span><span></span><span></span>
				</button>
			</div>
		</div>`;
	if (!document.body.classList.contains('page-home')) header.classList.add('is-light');
}

const footer = document.querySelector('[data-footer]');
if (footer) {
	footer.innerHTML = `
		<footer class="site-footer">
			<div class="wrap">
				<div class="footer-grid">
					<div>
						<img class="footer-logo" src="assets/logo-white.png" alt="Pátio Luanda" width="160" height="48">
						<p>Boa comida. Grandes encontros. Um lugar para estar em Luanda.</p>
						<div class="socials">
							<a href="${PATIO.instagram}" aria-label="Instagram">Instagram</a>
							<a href="${PATIO.facebook}" aria-label="Facebook">Facebook</a>
						</div>
					</div>
					<div>
						<h4>Explorar</h4>
						<a href="descobrir.html">Descobrir o Pátio</a>
						<a href="espacos.html">Os nossos espaços</a>
						<a href="menus.html">Menus</a>
						<a href="contacto.html">Contactos</a>
						<a href="fala-comigo.html">Fala Comigo</a>
					</div>
					<div>
						<h4>Reservar</h4>
						<a class="text-link" href="reservas.html">Reservar mesa</a>
						<a href="eventos.html">Pedir Proposta</a>
						<a href="${patioWhatsAppUrl()}">WhatsApp</a>
						<a href="tel:${PATIO.phone.replace(/\s/g, '')}">${PATIO.phone}</a>
						<a href="mailto:${PATIO.email}">${PATIO.email}</a>
					</div>
					<div>
						<h4>Localizações</h4>
						<a href="${PATIO.locations.morrobento.mapsUrl}" target="_blank" rel="noopener">Pátio Luanda · Morro Bento</a>
						<a href="${PATIO.locations.pastelaria?.mapsUrl || PATIO.locations.morrobento.mapsUrl}" target="_blank" rel="noopener">Pastelaria Pátio · Morro Bento</a>
						<a href="${PATIO.locations.roots.mapsUrl}" target="_blank" rel="noopener">Roots · Luanda</a>
						<a href="${PATIO.locations.mutamba.mapsUrl}" target="_blank" rel="noopener">Pátio Luanda · Mutamba</a>
						<p>${PATIO.hours}</p>
					</div>
				</div>
				<div class="footer-bottom">
					<span>© ${new Date().getFullYear()} Pátio Luanda. Todos os direitos reservados.</span>
					<span>Boa comida, em Luanda e na sua memória.</span>
				</div>
			</div>
		</footer>`;
}

document.body.insertAdjacentHTML('beforeend', `
	<a class="wa" data-whatsapp-float href="${patioWhatsAppUrl(patioPageWhatsAppMessage())}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11 11 0 0 0 2.1 17.8L1 23l5.3-1.1A11 11 0 0 0 20.5 3.5Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.2.7.7-3.1-.2-.3A9 9 0 1 1 12 20.5Zm5-6.7c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.1 8.1 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.3-.4c.1-.2 0-.3 0-.5l-.9-2.1c-.2-.6-.5-.5-.6-.5h-.5c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.2 3a10.5 10.5 0 0 0 4 3.5c.6.2 1 .2 1.4.1a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.1-.2-.2-.5-.3Z"/></svg>
	</a>
`);

window.addEventListener('scroll', () => {
	if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
}, { passive: true });

if (!document.getElementById('restaurant-schema')) {
	const schema = {
		'@context': 'https://schema.org',
		'@type': 'Restaurant',
		name: 'Pátio Luanda',
		image: 'assets/logo-white.png',
		telephone: PATIO.phone,
		email: PATIO.email,
		servesCuisine: ['Angolana', 'Contemporânea', 'Sushi'],
		priceRange: '$$',
		address: {
			'@type': 'PostalAddress',
			streetAddress: 'Av. Pedro de Castro Van-Dúnem Loy',
			addressLocality: 'Luanda',
			addressRegion: 'Luanda',
			addressCountry: 'AO',
		},
		openingHoursSpecification: {
			'@type': 'OpeningHoursSpecification',
			dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
			opens: '12:00',
			closes: '23:00',
		},
		sameAs: [PATIO.instagram, PATIO.facebook],
	};
	const tag = document.createElement('script');
	tag.type = 'application/ld+json';
	tag.id = 'restaurant-schema';
	tag.textContent = JSON.stringify(schema);
	document.head.appendChild(tag);
}
