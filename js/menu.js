async function loadJson(path) {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
	return response.json();
}

const menuPreview = document.querySelector('[data-menu-preview]');
const menuRoot = document.querySelector('[data-menu-root]');

function escapeMenuText(value) {
	return String(value ?? '').replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
	}[character]));
}

function formatMenuPrice(value) {
	return `${new Intl.NumberFormat('pt-PT').format(Number(value) || 0)} Kz`;
}

if (menuPreview || menuRoot) {
	loadJson('/api/menu')
		.then((data) => {
			const items = data.categories.flatMap((category) => category.items);

			if (menuPreview) {
				menuPreview.innerHTML = items.slice(0, 3)
					.map((item) => `<div class="dish"><em>${escapeMenuText(item.name)}</em><span>${formatMenuPrice(item.price)}</span></div>`)
					.join('');
			}

			if (menuRoot) {
				menuRoot.innerHTML = data.categories.map((category) => `
					<section class="menu-category reveal">
						<h2>${escapeMenuText(category.category)}</h2>
						${category.items.map((item) => `
							<article class="menu-item">
								<img src="${escapeMenuText(item.image)}" alt="${escapeMenuText(item.name)}" loading="lazy" width="240" height="180">
								<div><h3>${escapeMenuText(item.name)}</h3><p>${escapeMenuText(item.description)}</p></div>
								<span class="menu-price">${formatMenuPrice(item.price)}</span>
							</article>
						`).join('')}
					</section>
				`).join('');
			}
		})
		.catch((error) => {
			if (menuRoot) {
				menuRoot.innerHTML = '<p class="form-status">O menu está temporariamente indisponível. Contacte-nos para conhecer a carta atual.</p>';
			}
		});
}
