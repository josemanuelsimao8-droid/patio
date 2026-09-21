function loadJson(path) {
	return fetch(path).then((response) => {
		if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
		return response.json();
	});
}

const hero = document.querySelector('[data-hero]');
if (hero) {
	const slides = [...hero.querySelectorAll('.hero-slide')];
	const dotsWrap = hero.querySelector('[data-hero-dots]');
	let index = 0;
	let timer;

	dotsWrap.innerHTML = slides.map((_, i) => `<button class="hero-dot${i === 0 ? ' is-active' : ''}" type="button" aria-label="Slide ${i + 1}"></button>`).join('');
	const dots = [...dotsWrap.children];

	const show = (next) => {
		slides[index].classList.remove('is-active');
		dots[index].classList.remove('is-active');
		index = (next + slides.length) % slides.length;
		slides[index].classList.add('is-active');
		dots[index].classList.add('is-active');
	};

	const play = () => {
		clearInterval(timer);
		timer = setInterval(() => show(index + 1), 6500);
	};

	hero.querySelector('[data-hero-prev]')?.addEventListener('click', () => { show(index - 1); play(); });
	hero.querySelector('[data-hero-next]')?.addEventListener('click', () => { show(index + 1); play(); });
	dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); play(); }));
	play();
}

const quotes = document.querySelector('[data-quotes]');
if (quotes) {
	loadJson('data/reviews.json').then((data) => {
		quotes.querySelector('[data-quote-track]').innerHTML = data.reviews.map((item) => `
			<blockquote class="quote">
				<span class="script" aria-hidden="true">“</span>
				<p>${item.quote}</p>
				<footer><strong>${item.author}</strong><br>${item.role}</footer>
			</blockquote>`).join('');
		let index = 0;
		const track = quotes.querySelector('[data-quote-track]');
		const total = data.reviews.length;
		const go = (dir) => {
			index = (index + dir + total) % total;
			track.style.transform = `translateX(-${index * 100}%)`;
		};
		quotes.querySelector('[data-quote-prev]').addEventListener('click', () => go(-1));
		quotes.querySelector('[data-quote-next]').addEventListener('click', () => go(1));
	}).catch(console.error);
}

const menuRoot = document.querySelector('[data-menu-root]');
const menuPreview = document.querySelector('[data-menu-preview]');
if (menuRoot || menuPreview) {
	loadJson('data/menu.json').then((data) => {
		if (menuPreview) {
			const featured = data.categories.flatMap((cat) => cat.items.map((item) => ({ ...item, cat: cat.category, id: cat.id }))).slice(0, 4);
			menuPreview.innerHTML = featured.map((item) => `
				<article class="dish-card reveal">
					<img src="${item.image}" alt="${item.name}" loading="lazy" width="600" height="400">
					<span class="eyebrow">${item.cat}</span>
					<h3>${item.name}</h3>
					<p>${item.description}</p>
					<span class="price">${item.price}</span>
				</article>`).join('');
			document.querySelectorAll('[data-menu-preview] .reveal').forEach((el) => el.classList.add('visible'));
		}

		if (menuRoot) {
			const render = (id) => {
				const cats = id === 'all' ? data.categories : data.categories.filter((cat) => cat.id === id);
				menuRoot.innerHTML = cats.map((cat) => `
					<section class="menu-category" id="${cat.id}">
						<h2>${cat.category}</h2>
						${cat.items.map((item) => `
							<article class="menu-item">
								<img src="${item.image}" alt="${item.name}" loading="lazy" width="240" height="180">
								<div><h3>${item.name}</h3><p>${item.description}</p></div>
								<span class="price">${item.price}</span>
							</article>`).join('')}
					</section>`).join('');
			};
			render('all');
			document.querySelectorAll('[data-filter]').forEach((btn) => {
				btn.addEventListener('click', () => {
					document.querySelectorAll('[data-filter]').forEach((el) => el.classList.remove('is-active'));
					btn.classList.add('is-active');
					render(btn.dataset.filter);
				});
			});
		}
	}).catch((error) => {
		if (menuRoot) menuRoot.innerHTML = '<p>A carta está temporariamente indisponível. Fale connosco para conhecer os pratos do dia.</p>';
		console.error(error);
	});
}

const lightbox = document.querySelector('[data-lightbox]');
const galleryImages = [...document.querySelectorAll('[data-gallery] img')];
if (lightbox && galleryImages.length) {
	const image = lightbox.querySelector('img');
	let current = 0;
	const show = (index) => {
		current = (index + galleryImages.length) % galleryImages.length;
		image.src = galleryImages[current].src;
		image.alt = galleryImages[current].alt;
		lightbox.classList.remove('hidden');
	};
	galleryImages.forEach((img, index) => img.addEventListener('click', () => show(index)));
	lightbox.querySelector('[data-close]').addEventListener('click', () => lightbox.classList.add('hidden'));
	lightbox.querySelector('[data-prev]').addEventListener('click', () => show(current - 1));
	lightbox.querySelector('[data-next]').addEventListener('click', () => show(current + 1));
	document.addEventListener('keydown', (event) => {
		if (lightbox.classList.contains('hidden')) return;
		if (event.key === 'Escape') lightbox.classList.add('hidden');
		if (event.key === 'ArrowLeft') show(current - 1);
		if (event.key === 'ArrowRight') show(current + 1);
	});
}

document.querySelectorAll('[data-count]').forEach((el) => {
	const target = Number(el.dataset.count);
	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			let value = 0;
			const step = Math.max(1, Math.round(target / 60));
			const tick = setInterval(() => {
				value += step;
				if (value >= target) {
					value = target;
					clearInterval(tick);
				}
				el.textContent = target >= 1000 ? `+${value.toLocaleString('pt-PT')}` : `+${value}`;
			}, 24);
			observer.disconnect();
		});
	}, { threshold: 0.4 });
	observer.observe(el);
});
