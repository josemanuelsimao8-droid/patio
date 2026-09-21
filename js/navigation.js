document.addEventListener('click', (event) => {
	const toggle = event.target.closest('.menu-toggle');
	const parent = event.target.closest('.nav-parent');
	const langBtn = event.target.closest('.lang-btn');
	const mobile = window.matchMedia('(max-width: 900px)').matches;

	if (toggle) {
		const nav = document.querySelector('.nav-links');
		const open = nav.classList.toggle('open');
		toggle.setAttribute('aria-expanded', String(open));
	}

	if (parent && mobile) {
		event.preventDefault();
		const item = parent.closest('.nav-item');
		const open = item.classList.toggle('open');
		parent.setAttribute('aria-expanded', String(open));
	}

	if (langBtn) {
		const wrap = langBtn.closest('.lang');
		const open = wrap.classList.toggle('open');
		langBtn.setAttribute('aria-expanded', String(open));
	}

	if (!event.target.closest('.lang')) {
		document.querySelectorAll('.lang.open').forEach((el) => el.classList.remove('open'));
	}
});
