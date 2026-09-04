document.addEventListener('click', (event) => {
	const toggle = event.target.closest('.menu-toggle');
	const parentLink = event.target.closest('.nav-parent');

	if (parentLink && window.matchMedia('(max-width: 760px)').matches) {
		event.preventDefault();
		const dropdown = parentLink.closest('.nav-dropdown');
		const open = dropdown.classList.toggle('open');
		parentLink.setAttribute('aria-expanded', String(open));
	}

	if (toggle) {
		const nav = document.querySelector('.nav-links');
		const open = nav.classList.toggle('open');
		toggle.setAttribute('aria-expanded', String(open));
	}

	const link = event.target.closest('a');
	const isInternalPage = link
		&& link.origin === location.origin
		&& link.pathname.endsWith('.html')
		&& !event.ctrlKey
		&& !event.metaKey;

	if (isInternalPage) {
		event.preventDefault();
		document.body.classList.add('page-leave');
		setTimeout(() => { location.href = link.href; }, 280);
	}
});
