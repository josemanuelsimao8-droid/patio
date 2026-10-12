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
			const menuViews = [
				{ id: 'menu-roots', label: 'Menu Roots / Pátio Mutamba', categories: ['carnes', 'mar', 'entradas'] },
				{ id: 'bebidas', label: 'Bebidas', categories: ['bebidas'] },
				{ id: 'sobremesas', label: 'Sobremesas', categories: ['sobremesas'] },
				{ id: 'pastelaria', label: 'Pastelaria', categories: [] },
				{ id: 'sushi', label: 'Menu de Sushi', categories: ['sushi'] },
			];
			const itemMarkup = (item) => `
				<article class="menu-item">
					<img src="${item.image}" alt="${item.name}" loading="lazy" width="240" height="180">
					<div><h3>${item.name}</h3><p>${item.description}</p></div>
					<span class="price">${item.price}</span>
				</article>`;
			const render = (id) => {
				const view = menuViews.find((entry) => entry.id === id) || menuViews[0];
				const categories = data.categories.filter((category) => view.categories.includes(category.id));
				const content = view.id === 'pastelaria'
					? `<div class="menu-feature">
						<img src="assets/images/prato6.jpg" alt="Doçaria da Pastelaria Pátio" loading="lazy" width="900" height="700">
						<div><h3>Produção própria, sabores do dia</h3><p>A Pastelaria Pátio prepara doces e salgados para acompanhar as suas pausas. A seleção varia diariamente; contacte a equipa para saber o que está disponível.</p><a class="text-link" href="espacos.html#pastelaria">Conhecer a Pastelaria Pátio</a></div>
					</div>`
					: categories.map((category) => `
						<section class="menu-subcategory">
							${view.id === 'menu-roots' ? `<h3>${category.category}</h3>` : ''}
							${category.items.map(itemMarkup).join('')}
						</section>`).join('');
				const sushiLinks = view.id === 'sushi' ? `
					<div class="menu-downloads">
						<a class="btn" href="assets/menu-sushi.pdf" target="_blank" rel="noopener">Abrir menu de sushi (PDF)</a>
						<a class="text-link" href="assets/menu-sushi.pdf" download="menu-sushi-roots.pdf">Descarregar PDF</a>
					</div>` : '';
				menuRoot.innerHTML = `<section class="menu-category"><h2>${view.label}</h2>${view.id === 'menu-roots' ? '<p class="lede">Uma carta partilhada entre o Roots e o Pátio Mutamba.</p>' : ''}${sushiLinks}${content}</section>`;
				document.querySelectorAll('[data-menu-category]').forEach((button) => {
					const active = button.dataset.menuCategory === view.id;
					button.classList.toggle('is-active', active);
					button.setAttribute('aria-pressed', String(active));
				});
			};

			const initialView = location.hash.slice(1);
			render(menuViews.some((view) => view.id === initialView) ? initialView : menuViews[0].id);
			document.querySelectorAll('[data-menu-category]').forEach((button) => {
				button.addEventListener('click', () => {
					render(button.dataset.menuCategory);
					history.replaceState(null, '', `#${button.dataset.menuCategory}`);
				});
			});
			window.addEventListener('hashchange', () => render(location.hash.slice(1)));
		}
	}).catch((error) => {
		if (menuRoot) menuRoot.innerHTML = '<p>A carta está temporariamente indisponível. Fale connosco para conhecer os pratos do dia.</p>';
		console.error(error);
	});
}

const galleryPage = document.querySelector('[data-gallery-page]');
if (galleryPage) {
	const nav = document.querySelector('[data-gallery-space-nav]');
	const lightbox = document.querySelector('[data-gallery-lightbox]');
	const lightboxImage = lightbox.querySelector('[data-lightbox-image]');
	const lightboxCaption = lightbox.querySelector('[data-lightbox-caption]');
	let activeImages = [];
	let activeIndex = 0;

	const showLightboxImage = (index) => {
		activeIndex = (index + activeImages.length) % activeImages.length;
		const selected = activeImages[activeIndex];
		lightboxImage.src = selected.src;
		lightboxImage.alt = selected.alt;
		lightboxCaption.textContent = selected.caption;
	};

	loadJson('data/spaces.json?v=20261011-gallery').then(({ spaces }) => {
		const sections = spaces.map((space) => {
			const images = [
				...(space.gallery || []).map((src) => ({ src, collection: 'Espaço' })),
				...(space.foodGallery || []).map((src) => ({ src, collection: 'À mesa' })),
				...(!space.gallery?.length && !space.foodGallery?.length && space.image ? [{ src: space.image, collection: 'Espaço' }] : []),
			];
			const id = space.id || space.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			return { ...space, id, images };
		});

		nav.innerHTML = sections.map((space) => `<a href="#galeria-${space.id}">${space.name}</a>`).join('');
		galleryPage.innerHTML = sections.map((space) => `
			<section class="gallery-space" id="galeria-${space.id}" aria-labelledby="titulo-${space.id}">
				<header class="gallery-space-heading">
					<div><p class="eyebrow">${space.location || 'Luanda'}</p><h2 id="titulo-${space.id}">${space.name}</h2></div>
					<a class="text-link" href="${space.href}">Conhecer espaço</a>
				</header>
				${space.images.length ? `
					${space.gallery?.length ? `<div class="gallery-collection-heading"><h3>O espaço</h3><span>${space.gallery.length} fotografias</span></div><div class="gallery-photo-grid">${space.gallery.map((src, index) => `<button class="gallery-photo" type="button" data-gallery-image data-src="${src}" data-caption="${space.name} · O espaço · ${index + 1}" aria-label="Ver fotografia ${index + 1} de ${space.name}"><img src="${src}" alt="${space.name} · espaço" loading="lazy" width="1200" height="800"></button>`).join('')}</div>` : ''}
					${space.foodGallery?.length ? `<div class="gallery-collection-heading"><h3>À mesa</h3><span>${space.foodGallery.length} fotografias</span></div><div class="gallery-photo-grid gallery-food-grid">${space.foodGallery.map((src, index) => `<button class="gallery-photo" type="button" data-gallery-image data-src="${src}" data-caption="${space.name} · À mesa · ${index + 1}" aria-label="Ver fotografia de prato ${index + 1} de ${space.name}"><img src="${src}" alt="Prato do ${space.name}" loading="lazy" width="1200" height="800"></button>`).join('')}</div>` : ''}
					${!space.gallery?.length && !space.foodGallery?.length ? `<div class="gallery-photo-grid"><button class="gallery-photo" type="button" data-gallery-image data-src="${space.image}" data-caption="${space.name}" aria-label="Ver fotografia de ${space.name}"><img src="${space.image}" alt="${space.name}" loading="lazy" width="1200" height="800"></button></div>` : ''}` : `<div class="gallery-unavailable"><p>As fotografias deste espaço serão acrescentadas em breve.</p></div>`}
			</section>`).join('');

		activeImages = [...galleryPage.querySelectorAll('[data-gallery-image]')].map((button) => ({
			src: button.dataset.src,
			alt: button.querySelector('img').alt,
			caption: button.dataset.caption,
		}));

		galleryPage.querySelectorAll('[data-gallery-image]').forEach((button, index) => {
			button.addEventListener('click', () => {
				showLightboxImage(index);
				lightbox.showModal();
			});
		});
	}).catch((error) => {
		galleryPage.innerHTML = '<p class="form-status">Não foi possível carregar a galeria. Tente novamente mais tarde.</p>';
		console.error(error);
	});

	lightbox.querySelector('[data-lightbox-close]').addEventListener('click', () => lightbox.close());
	lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => showLightboxImage(activeIndex - 1));
	lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => showLightboxImage(activeIndex + 1));
	lightbox.addEventListener('click', (event) => {
		if (event.target === lightbox) lightbox.close();
	});
	document.addEventListener('keydown', (event) => {
		if (!lightbox.open) return;
		if (event.key === 'ArrowLeft') showLightboxImage(activeIndex - 1);
		if (event.key === 'ArrowRight') showLightboxImage(activeIndex + 1);
	});
}

const spaceGalleries = [...document.querySelectorAll('[data-space-gallery]')];
if (spaceGalleries.length) {
	loadJson('data/spaces.json?v=20261011-space-galleries').then((data) => {
		spaceGalleries.forEach((gallery) => {
			const space = data.spaces.find((item) => item.id === gallery.dataset.spaceGallery);
			const images = gallery.dataset.galleryType === 'food' ? space.foodGallery : space.gallery;
			gallery.innerHTML = images.map((image, index) => `
				<figure class="space-photo-gallery-item">
					<img src="${image}" alt="${space.name}, fotografia ${index + 1}" loading="lazy" width="1800" height="2700">
				</figure>`).join('');
		});
	}).catch((error) => {
		spaceGalleries.forEach((gallery) => {
			gallery.innerHTML = '<p class="form-status">A galeria está temporariamente indisponível.</p>';
		});
		console.error(error);
	});
}

const spaceHeroVideo = document.querySelector('[data-space-hero-video]');
if (spaceHeroVideo && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
	const videos = [
		{
			path: 'assets/videos/patio-morro-bento-3s.mp4',
			name: 'Pátio Morro Bento',
		},
		{
			path: 'assets/videos/patio-mutamba-3s.mp4',
			name: 'Pátio Mutamba',
		},
		{
			path: 'assets/videos/patio-mutamba-foods-3s.mp4',
			name: 'Pátio Mutamba',
		},
	];
	const caption = document.querySelector('[data-space-hero-caption]');
	let previousIndex = -1;
	const playRandomClip = () => {
		let index = Math.floor(Math.random() * videos.length);
		if (videos.length > 1 && index === previousIndex) index = (index + 1 + Math.floor(Math.random() * (videos.length - 1))) % videos.length;
		previousIndex = index;
		const selected = videos[index];
		spaceHeroVideo.src = encodeURI(selected.path);
		if (caption) caption.textContent = selected.name;
		spaceHeroVideo.play().catch(() => {});
	};
	spaceHeroVideo.addEventListener('ended', playRandomClip);
	playRandomClip();
}

const locationCards = document.querySelector('[data-location-cards]');
if (locationCards) {
	const locations = ['morrobento', 'pastelaria', 'roots', 'mutamba', 'aeroporto'].map((id) => PATIO.locations[id]);
	locationCards.innerHTML = locations.map((place) => `
		<article class="location">
			${place.image ? `<img src="${place.image}" alt="${place.name}" loading="lazy" width="720" height="480">` : `<div class="location-image-placeholder" aria-label="Fotografia do Pátio Aeroporto ainda não disponível">Pátio Aeroporto</div>`}
			<div class="location-body">
				<h3>${place.name}</h3>
				<p><strong>Morada</strong><br>${place.address}</p>
				<p><strong>Horário geral</strong><br>${PATIO.hours}</p>
				<p><strong>Contacto</strong><br><a href="tel:${PATIO.phone.replace(/\s/g, '')}">${PATIO.phone}</a><a href="mailto:${PATIO.email}">${PATIO.email}</a></p>
				<a class="btn btn-ghost location-directions" href="${place.mapsUrl}" target="_blank" rel="noopener">Obter direções</a>
			</div>
		</article>`).join('');
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
