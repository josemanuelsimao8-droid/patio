const page = document.body;
const navItems = [
	['Pátio Luanda', 'patio-luanda.html'],
	['Espaços', 'espacos.html'],
	['Reservas', 'reservas.html'],
	['Menu', 'menu.html'],
	['Contacto', 'contacto.html'],
];
const header = document.querySelector('[data-header]');

if (header) {
	const links = navItems.map(([label, url]) => `<a href="${url}">${label}</a>`).join('');
	header.innerHTML = `
		<div class="wrap nav">
			<a class="wordmark" href="index.html" aria-label="Pátio Luanda, início">
				<img class="brand-logo" src="assets/logo-white.png" alt="Pátio Luanda" width="180" height="54">
			</a>
			<nav class="nav-links" id="main-nav" aria-label="Navegação principal">
				${links}
				<a class="nav-cta" href="reservas.html">Reservar</a>
			</nav>
			<button class="menu-toggle" aria-expanded="false" aria-controls="main-nav">Menu +</button>
		</div>`;

	if (!page.classList.contains('page-home')) header.classList.add('is-solid');
}

const footer = document.querySelector('[data-footer]');
if (footer) {
	footer.innerHTML = `
		<div class="wrap">
			<div class="footer-grid">
				<div class="footer-brand">
					<img class="footer-logo" src="assets/logo-white.png" alt="Pátio Luanda" width="180" height="54">
					
				</div>
				<div>
					<h4>Visite-nos</h4>
					<p>Shopping ennida Av, </p>
					<p>Av. Pedro de Castro Van-Dúnem Loy 62, Luanda</p>
					<p>Ter — Dom · 12h — 23h</p>
				</div>
				<div>
					<h4>Fale connosco</h4>
					<a href="tel:+244941180424">+244 941 180 424</a>
					<a href="mailto:ola@patioluanda.co.ao">ola@patioluanda.co.ao</a>
					<a href="reservas.html">Planear um evento</a>
				</div>
				<div>
					<h4>Seguir</h4>
					<a href="#">Instagram</a>
					<a href="#">Facebook</a>
					<a href="reservas.html">Reservar</a>
				</div>
			</div>
			<div class="footer-bottom">
				<span>© 2026 Pátio Luanda</span>
				<span>Feito para ficar mais um pouco.</span>
			</div>
		</div>`;
}

const active = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach((link) => {
	if (link.getAttribute('href') === active) link.classList.add('active');
});
