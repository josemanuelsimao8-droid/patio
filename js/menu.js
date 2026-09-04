async function loadJson(path) {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
	return response.json();
}

const menuPreview = document.querySelector('[data-menu-preview]');
const menuRoot = document.querySelector('[data-menu-root]');

if (menuPreview || menuRoot) {
	loadJson('data/menu.json')
		.then((data) => {
			const items = data.categories.flatMap((category) => category.items);

			if (menuPreview) {
				menuPreview.innerHTML = items.slice(0, 3)
					.map((item) => `<div class="dish"><em>${item.name}</em><span>${item.price}</span></div>`)
					.join('');
			}

			if (menuRoot) {
				menuRoot.innerHTML = data.categories.map((category) => `
					<section class="menu-category reveal">
						<h2>${category.category}</h2>
						${category.items.map((item) => `
							<article class="menu-item">
								<div><h3>${item.name}</h3><p>${item.description}</p></div>
								<span class="menu-price">${item.price}</span>
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
			console.error(error);
		});
}
