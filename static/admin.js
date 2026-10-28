(() => {
	const pages = [
		['index.html', 'Início'], ['descobrir.html', 'Descobrir o Pátio'], ['espacos.html', 'Espaços'],
		['morrobento.html', 'Morro Bento'], ['mutamba.html', 'Mutamba'], ['roots.html', 'Roots'],
		['patio-luanda.html', 'Pátio Luanda'], ['menus.html', 'Menus'], ['menu.html', 'Menu'],
		['galeria.html', 'Galeria'], ['eventos.html', 'Eventos'], ['reservas.html', 'Reservas'],
		['contacto.html', 'Contactos'], ['fala-comigo.html', 'Fala Comigo'],
	];
	const body = document.body;
	const csrf = body.dataset.csrfToken;
	const content = { brand: {}, pages: {} };
	const pageSelect = document.querySelector('#page-select');
	const iframe = document.querySelector('[data-site-preview]');
	const list = document.querySelector('[data-section-editor-list]');
	let activePage = 'index.html';
	let saveTimer;
	let toastTimer;
	let saveRevision = 0;
	let pageSaveQueue = Promise.resolve();

	const pageLabel = (file) => pages.find(([path]) => path === file)?.[1] || file;
	const escapeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
	const make = (tag, className, text) => {
		const element = document.createElement(tag);
		if (className) element.className = className;
		if (text !== undefined) element.textContent = text;
		return element;
	};
	const setState = (element, message, dirty = false) => {
		element.textContent = message;
		element.classList.toggle('is-dirty', dirty);
	};

	function toast(message, isError = false) {
		const element = document.querySelector('[data-toast]');
		element.textContent = message;
		element.classList.toggle('is-error', isError);
		element.classList.add('is-visible');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => element.classList.remove('is-visible'), 3200);
	}

	async function request(url, options = {}) {
		const response = await fetch(url, {
			...options,
			headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'X-CSRFToken': csrf, ...options.headers },
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
		return result;
	}

	function scheduleSave() {
		setState(document.querySelector('[data-save-state]'), 'Alterações por guardar', true);
		clearTimeout(saveTimer);
		saveRevision += 1;
		previewDraft();
		saveTimer = setTimeout(() => saveContent(document.querySelector('[data-save-state]')), 600);
	}

	function initializePagePicker() {
		pages.forEach(([file, label]) => {
			const option = make('option', '', label);
			option.value = file;
			pageSelect.append(option);
		});
		pageSelect.addEventListener('change', () => loadPage(pageSelect.value));
		document.querySelector('[data-refresh-preview]').addEventListener('click', () => loadPage(activePage, true));
	}

	function loadPage(file, refresh = false) {
		activePage = file;
		setState(document.querySelector('[data-save-state]'), 'Alterações guardadas');
		list.innerHTML = '<div class="editor-loading">A carregar a página…</div>';
		iframe.src = `${encodeURI(file)}?cms_preview=1&revision=${Date.now()}`;
		iframe.onload = async () => {
			try {
				await iframe.contentWindow.siteCmsReady;
			} catch (_error) {}
			buildSectionEditor();
			if (refresh) toast(`Pré-visualização de ${pageLabel(file)} atualizada.`);
		};
	}

	function getPageData() {
		if (!content.pages[activePage]) content.pages[activePage] = { sections: {}, order: [] };
		const page = content.pages[activePage];
		if (!page.sections) page.sections = {};
		if (!Array.isArray(page.order)) page.order = [];
		return page;
	}

	function buildSectionEditor() {
		const doc = iframe.contentDocument;
		const sections = [...doc.querySelectorAll('main > section')];
		const pageData = getPageData();
		const keys = sections.map((section, index) => {
			const key = section.dataset.cmsSectionKey || section.id || `section-${index + 1}`;
			section.dataset.cmsSectionKey = key;
			return key;
		});
		pageData.order = pageData.order.length ? [...pageData.order.filter((key) => keys.includes(key)), ...keys.filter((key) => !pageData.order.includes(key))] : keys;
		sections.forEach((section, index) => {
			const key = keys[index];
			if (!pageData.sections[key]) pageData.sections[key] = { fields: {}, images: [], backgrounds: [], videos: [], visible: !section.hidden, layout: 'original' };
			const data = pageData.sections[key];
			if (!Array.isArray(data.images)) data.images = [];
			if (!Array.isArray(data.backgrounds)) data.backgrounds = [];
			if (!Array.isArray(data.videos)) data.videos = [];
			const textNodes = collectTextNodes(section);
			if (data.fieldsVersion !== 2) {
				data.fields = Object.fromEntries(textNodes.map((node, fieldIndex) => [fieldIndex, node.nodeValue]));
				data.fieldsVersion = 2;
			} else {
				textNodes.forEach((node, fieldIndex) => {
					if (data.fields[fieldIndex] === undefined) data.fields[fieldIndex] = node.nodeValue;
				});
			}
			[...section.querySelectorAll('img')].forEach((image, imageIndex) => {
				if (!data.images[imageIndex]) data.images[imageIndex] = { src: image.getAttribute('src') || '', alt: image.alt || '' };
			});
			const backgrounds = collectBackgroundImages(section);
			backgrounds.forEach((entry, imageIndex) => {
				if (!data.backgrounds[imageIndex]) data.backgrounds[imageIndex] = entry;
			});
			const videos = [...section.querySelectorAll('video source')];
			videos.forEach((video, videoIndex) => {
				if (data.videos[videoIndex] === undefined) data.videos[videoIndex] = video.getAttribute('src') || '';
			});
		});
		pageData.order.forEach((key) => {
			const section = sections.find((item) => item.dataset.cmsSectionKey === key);
			if (section) doc.querySelector('main').append(section);
		});
		document.querySelector('[data-section-count]').textContent = `${sections.length} secç${sections.length === 1 ? 'ão' : 'ões'}`;
		list.replaceChildren();
		if (!sections.length) {
			list.append(make('p', 'empty-section', 'Esta página não tem secções <main> para editar.'));
			return;
		}
		pageData.order.forEach((key, orderIndex) => {
			const section = sections.find((item) => item.dataset.cmsSectionKey === key);
			if (!section) return;
			list.append(createSectionCard(section, key, orderIndex, pageData.order.length));
		});
	}

	function createSectionCard(section, key, orderIndex, total) {
		const pageData = getPageData();
		const data = pageData.sections[key];
		const fields = collectTextNodes(section);
		const details = make('details', 'edit-section');
		details.open = orderIndex === 0;
		details.hidden = data.visible === false;
		const summary = make('summary', 'section-summary');
		const number = make('span', 'section-number', String(orderIndex + 1).padStart(2, '0'));
		const firstHeading = section.querySelector('h1, h2, h3, h4, h5, h6');
		const title = make('span', 'section-name', escapeText(firstHeading?.textContent || section.id || `Secção ${orderIndex + 1}`));
		const order = make('span', 'section-order');
		order.addEventListener('click', (event) => event.stopPropagation());
		[["↑", -1, 'Subir secção'], ["↓", 1, 'Descer secção']].forEach(([label, delta, description]) => {
			const button = make('button', '', label);
			button.type = 'button';
			button.title = description;
			button.setAttribute('aria-label', description);
			button.disabled = orderIndex + delta < 0 || orderIndex + delta >= total;
			button.addEventListener('click', () => moveSection(key, orderIndex + delta));
			order.append(button);
		});
		summary.append(number, title, order);
		const fieldsWrap = make('div', 'section-fields');
		fields.forEach((field, fieldIndex) => {
			const label = make('label', 'field-label', textNodeLabel(field, fieldIndex, fields));
			const isLongText = String(data.fields[fieldIndex] || '').length > 95;
			const input = make(isLongText ? 'textarea' : 'input');
			if (input.tagName === 'INPUT') input.type = 'text';
			input.value = data.fields[fieldIndex] ?? field.nodeValue;
			input.setAttribute('aria-label', `${textNodeLabel(field, fieldIndex, fields)} da secção ${orderIndex + 1}`);
			input.addEventListener('input', () => {
				data.fields[fieldIndex] = input.value;
				scheduleSave();
				title.textContent = escapeText(firstHeading?.textContent || section.id || `Secção ${orderIndex + 1}`);
			});
			label.append(input);
			fieldsWrap.append(label);
		});

		const options = make('div', 'section-options');
		const layoutLabel = make('label', '', 'Disposição');
		const layoutSelect = make('select');
		[['original', 'Original'], ['copy-left', 'Texto à esquerda'], ['copy-right', 'Texto à direita'], ['full', 'Largura total']].forEach(([value, text]) => {
			const option = make('option', '', text);
			option.value = value;
			layoutSelect.append(option);
		});
		layoutSelect.value = data.layout || 'original';
		layoutSelect.addEventListener('change', () => { data.layout = layoutSelect.value; scheduleSave(); });
		layoutLabel.append(layoutSelect);
		const visibilityLabel = make('label', 'visibility-control', 'Mostrar secção');
		const visibility = make('input');
		visibility.type = 'checkbox';
		visibility.checked = data.visible !== false;
		visibility.addEventListener('change', () => {
			data.visible = visibility.checked;
			details.hidden = !visibility.checked;
			scheduleSave();
		});
		visibilityLabel.prepend(visibility);
		options.append(layoutLabel, visibilityLabel);
		fieldsWrap.append(options);

		const links = [...section.querySelectorAll('a')];
		if (!Array.isArray(data.links)) {
		    data.links = links.map((link) => link.getAttribute('href') || '');
		}
		if (links.length) {
		    fieldsWrap.append(make('p', 'links-heading', `Links e botões · ${links.length}`));
		    links.forEach((link, linkIndex) => {
		        const wrap = make('label', 'link-field');
		        const label = make('span', 'link-label', `${link.textContent.trim() || `Link ${linkIndex + 1}`} — destino`);
		        const input = make('input');
		        input.type = 'text';
		        input.value = data.links[linkIndex] || '';
		        input.placeholder = '/menus.html ou https://...';
		        input.setAttribute('aria-label', `Destino do link ${linkIndex + 1}`);
		        input.addEventListener('input', () => {
		            data.links[linkIndex] = input.value.trim();
		            scheduleSave();
		            previewDraft();
		        });
		        wrap.append(label, input);
		        fieldsWrap.append(wrap);
		    });
		}

		const images = [...section.querySelectorAll('img')];
		if (images.length) {
			fieldsWrap.append(make('p', 'images-heading', `Imagens e legendas · ${images.length}`));
			images.forEach((image, imageIndex) => fieldsWrap.append(createImageEditor(data, image, imageIndex)));
		}
		const backgroundImages = collectBackgroundImages(section);
		if (backgroundImages.length) {
			fieldsWrap.append(make('p', 'images-heading', `Imagens de fundo · ${backgroundImages.length}`));
			backgroundImages.forEach((image, imageIndex) => {
				fieldsWrap.append(createBackgroundEditor(data, image, imageIndex));
			});
		}
		const videos = [...section.querySelectorAll('video source')];
		if (videos.length) {
			fieldsWrap.append(make('p', 'images-heading', `Vídeos · ${videos.length}`));
			videos.forEach((video, videoIndex) => {
				const label = make('label', 'field-label', `Ficheiro do vídeo ${videoIndex + 1}`);
				const input = make('input');
				input.type = 'text';
				input.value = data.videos[videoIndex] || video.getAttribute('src') || '';
				input.addEventListener('input', () => {
					data.videos[videoIndex] = input.value;
					scheduleSave();
				});
				label.append(input);
				fieldsWrap.append(label);
			});
		}
		details.append(summary, fieldsWrap);
		return details;
	}

	function collectTextNodes(section) {
		const walker = iframe.contentDocument.createTreeWalker(
			section,
			iframe.contentWindow.NodeFilter.SHOW_TEXT,
		);
		const nodes = [];
		let node;
		while ((node = walker.nextNode())) {
			const parent = node.parentElement;
			if (!node.nodeValue.trim() || parent.closest('script, style, noscript, svg, [aria-hidden="true"], .hero-nav, .icon-btn')) continue;
			nodes.push(node);
		}
		return nodes;
	}

	function textNodeLabel(node, index, nodes) {
		const owner = node.parentElement.closest('h1, h2, h3, h4, h5, h6, p, a, button, li, label, figcaption, span, strong, em, small, dt, dd, legend')
			|| node.parentElement;
		const labels = {
			H1: 'Título principal', H2: 'Título', H3: 'Subtítulo', H4: 'Título', H5: 'Título', H6: 'Título',
			P: 'Texto', A: 'Link ou botão', BUTTON: 'Botão', LI: 'Item de lista', LABEL: 'Rótulo de campo',
			FIGCAPTION: 'Legenda', SPAN: 'Texto', STRONG: 'Texto em destaque', EM: 'Texto em destaque',
			SMALL: 'Texto auxiliar', DT: 'Termo', DD: 'Descrição',
		};
		const siblings = nodes.filter((candidate) => owner.contains(candidate));
		const part = siblings.indexOf(node);
		const suffix = siblings.length > 1 ? ` · parte ${part + 1}/${siblings.length}` : '';
		const context = owner.textContent.replace(/\s+/g, ' ').trim().slice(0, 42);
		return `${labels[owner.tagName] || 'Texto'}${suffix} · ${context || `Campo ${index + 1}`}`;
	}

	function collectBackgroundImages(section) {
		const elements = [section, ...section.querySelectorAll('*')];
		return elements.flatMap((element) => {
			const background = element.style.backgroundImage;
			const match = background.match(/url\((['"]?)(.*?)\1\)/i);
			return match ? [{ src: match[2], background }] : [];
		});
	}

	function createImageEditor(data, image, imageIndex) {
		const value = data.images[imageIndex] || { src: image.getAttribute('src') || '', alt: image.alt || '' };
		const wrap = make('div', 'image-field');
		const heading = make('div', 'image-field-head', `Imagem ${imageIndex + 1}`);
		const preview = make('img', 'image-preview');
		preview.src = value.src;
		preview.alt = '';
		const source = make('input');
		source.type = 'text';
		source.value = value.src;
		source.setAttribute('aria-label', `Ficheiro da imagem ${imageIndex + 1}`);
		source.addEventListener('input', () => { value.src = source.value; preview.src = value.src; scheduleSave(); });
		const alt = make('input');
		alt.type = 'text';
		alt.value = value.alt;
		alt.maxLength = 300;
		alt.placeholder = 'Legenda / descrição da imagem';
		alt.setAttribute('aria-label', `Legenda da imagem ${imageIndex + 1}`);
		alt.addEventListener('input', () => { value.alt = alt.value; scheduleSave(); });
		const upload = make('input');
		upload.type = 'file';
		upload.accept = 'image/png,image/jpeg,image/webp,image/gif';
		upload.setAttribute('aria-label', `Carregar nova imagem ${imageIndex + 1}`);
		upload.addEventListener('change', async () => {
			if (!upload.files[0]) return;
			upload.disabled = true;
			try {
				const formData = new FormData();
				formData.append('image', upload.files[0]);
				const result = await request('/api/admin/upload', { method: 'POST', body: formData });
				value.src = result.url;
				source.value = result.url;
				preview.src = result.url;
				scheduleSave();
				toast('Imagem carregada; a guardar automaticamente.');
			} catch (error) { toast(error.message, true); }
			upload.disabled = false;
		});
		data.images[imageIndex] = value;
		wrap.append(heading, preview, source, alt, upload);
		return wrap;
	}

	function createBackgroundEditor(data, image, imageIndex) {
		const value = data.backgrounds[imageIndex] || image;
		const wrap = make('div', 'image-field');
		const heading = make('div', 'image-field-head', `Fundo ${imageIndex + 1}`);
		const preview = make('img', 'image-preview');
		preview.src = value.src;
		preview.alt = '';
		const source = make('input');
		source.type = 'text';
		source.value = value.src;
		source.setAttribute('aria-label', `Ficheiro da imagem de fundo ${imageIndex + 1}`);
		source.addEventListener('input', () => {
			value.src = source.value;
			preview.src = value.src;
			data.backgrounds[imageIndex] = value;
			scheduleSave();
		});
		const upload = make('input');
		upload.type = 'file';
		upload.accept = 'image/png,image/jpeg,image/webp,image/gif';
		upload.setAttribute('aria-label', `Carregar imagem de fundo ${imageIndex + 1}`);
		upload.addEventListener('change', async () => {
			if (!upload.files[0]) return;
			upload.disabled = true;
			try {
				const formData = new FormData();
				formData.append('image', upload.files[0]);
				const result = await request('/api/admin/upload', { method: 'POST', body: formData });
				value.src = result.url;
				data.backgrounds[imageIndex] = value;
				source.value = result.url;
				preview.src = result.url;
				scheduleSave();
			} catch (error) { toast(error.message, true); }
			finally { upload.disabled = false; }
		});
		data.backgrounds[imageIndex] = value;
		wrap.append(heading, preview, source, upload);
		return wrap;
	}

	function moveSection(key, newIndex) {
		const order = getPageData().order;
		const oldIndex = order.indexOf(key);
		if (oldIndex < 0 || newIndex < 0 || newIndex >= order.length) return;
		order.splice(oldIndex, 1);
		order.splice(newIndex, 0, key);
		buildSectionEditor();
		scheduleSave();
	}

	function previewDraft() {
		if (!iframe.contentWindow?.applySiteCms) return;
		iframe.contentWindow.applySiteCms(content);
	}

	async function saveContent(stateElement, button = null) {
		const revision = saveRevision;
		const snapshot = JSON.stringify(content);
		if (button) button.disabled = true;
		const save = pageSaveQueue.catch(() => {}).then(() => request('/api/admin/site-content', {
			method: 'PUT',
			body: snapshot,
		}));
		pageSaveQueue = save;
		try {
			await save;
			if (revision === saveRevision) setState(stateElement, 'Guardado automaticamente');
			if (button) toast('Alterações guardadas no site.');
		} catch (error) {
			if (revision === saveRevision) setState(stateElement, 'Falha ao guardar', true);
			toast(error.message, true);
		} finally {
			if (button) button.disabled = false;
		}
	}

	function setupIdentity() {
		const form = document.querySelector('[data-identity-form]');
		const preview = document.querySelector('[data-logo-preview]');
		const logoInput = form.elements.logo;
		Object.entries(content.brand).forEach(([key, value]) => {
			if (form.elements[key] && typeof value === 'string') form.elements[key].value = value;
		});
		preview.src = content.brand.logo || '';
		logoInput.addEventListener('input', () => { preview.src = logoInput.value; content.brand.logo = logoInput.value; });
		document.querySelector('[data-logo-upload]').addEventListener('change', async (event) => {
			if (!event.target.files[0]) return;
			try {
				const uploadData = new FormData();
				uploadData.append('image', event.target.files[0]);
				const result = await request('/api/admin/upload', { method: 'POST', body: uploadData });
				logoInput.value = result.url;
				content.brand.logo = result.url;
				preview.src = result.url;
				toast('Logótipo carregado. Guarde a identidade para publicar.');
			} catch (error) { toast(error.message, true); }
		});
		form.addEventListener('input', (event) => {
			if (event.target.name && event.target.type !== 'file') content.brand[event.target.name] = event.target.value;
			setState(document.querySelector('[data-identity-state]'), 'Alterações por guardar', true);
		});
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			await saveContent(document.querySelector('[data-identity-state]'), form.querySelector('[type="submit"]'));
		});
	}

	function renderReservations(reservations) {
		const tableBody = document.querySelector('[data-reservations-list]');
		tableBody.replaceChildren();
		if (!reservations.length) {
			const row = make('tr');
			const cell = make('td', '', 'Ainda não existem pedidos de reserva.');
			cell.colSpan = 8;
			row.append(cell);
			tableBody.append(row);
			return;
		}

		const statusLabels = { pending: 'Pendente', confirmed: 'Confirmada', rejected: 'Rejeitada' };
		reservations.forEach((reservation) => {
			const row = make('tr');
			const customer = make('td', '', reservation.name || '—');
			const contact = make('td');
			contact.append(make('span', '', reservation.phone || '—'));
			if (reservation.email) contact.append(make('small', '', reservation.email));
			const dateTime = make('td', '', String(reservation.dateTime || '').replace('T', ' · ') || '—');
			const details = make('td');
			const typeLabel = reservation.type === 'event' ? 'Evento' : 'Mesa';
			details.append(make('span', '', reservation.space || '—'));
			details.append(make('small', '', reservation.eventType
				? `${typeLabel} · ${reservation.eventType}`
				: typeLabel));
			const guests = make('td', '', String(reservation.guests ?? '—'));
			const currentStatus = statusLabels[reservation.status] ? reservation.status : 'pending';
			const statusCell = make('td');
			statusCell.append(make('span', `reservation-status reservation-status--${currentStatus}`, statusLabels[currentStatus]));
			const actionCell = make('td');
			const statusSelect = make('select');
			statusSelect.setAttribute('aria-label', `Alterar estado da reserva de ${reservation.name || 'cliente'}`);
			Object.entries(statusLabels).forEach(([value, label]) => {
				const option = make('option', '', label);
				option.value = value;
				statusSelect.append(option);
			});
			statusSelect.value = currentStatus;
			statusSelect.addEventListener('change', async () => {
				statusSelect.disabled = true;
				try {
					const result = await request(`/api/admin/reservations/${reservation.id}`, {
						method: 'PATCH',
						body: JSON.stringify({ status: statusSelect.value }),
					});
					reservation.status = result.status;
					statusCell.replaceChildren(make('span', `reservation-status reservation-status--${result.status}`, statusLabels[result.status]));
					document.querySelector('[data-reservations-feedback]').textContent = 'O estado da reserva foi atualizado.';
				} catch (error) {
					statusSelect.value = currentStatus;
					const feedback = document.querySelector('[data-reservations-feedback]');
					feedback.textContent = error instanceof TypeError
						? 'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.'
						: error.message;
					toast(feedback.textContent, true);
				} finally {
					statusSelect.disabled = false;
				}
			});
			actionCell.append(statusSelect);
			const notes = make('td');
			notes.append(make('p', '', reservation.notes || '—'));
			row.append(customer, contact, dateTime, details, guests, statusCell, actionCell, notes);
			tableBody.append(row);
		});
	}

	async function loadReservations() {
		const feedback = document.querySelector('[data-reservations-feedback]');
		const tableBody = document.querySelector('[data-reservations-list]');
		feedback.textContent = 'A carregar os pedidos…';
		try {
			const result = await request('/api/admin/reservations', { method: 'GET', headers: {} });
			if (!Array.isArray(result.reservations)) throw new Error('A resposta do servidor não contém uma lista de reservas válida.');
			renderReservations(result.reservations);
			feedback.textContent = result.reservations.length
				? `${result.reservations.length} pedido(s) carregado(s).`
				: 'Ainda não existem pedidos de reserva.';
		} catch (error) {
			tableBody.replaceChildren();
			const row = make('tr');
			const cell = make('td', '', 'Não foi possível carregar os pedidos.');
			cell.colSpan = 8;
			row.append(cell);
			tableBody.append(row);
			feedback.textContent = error instanceof TypeError
				? 'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.'
				: error.message;
		}
	}

	let menuItems = [];
	let menuCategories = [];
	let editingMenuId = null;
	let feedbackSearchTimer;

	function formatPrice(value) {
		return `${new Intl.NumberFormat('pt-PT').format(Number(value) || 0)} Kz`;
	}

	function renderMenu() {
		const tableBody = document.querySelector('[data-menu-list]');
		const search = document.querySelector('[data-menu-search]').value.trim().toLocaleLowerCase('pt-PT');
		const category = document.querySelector('[data-menu-category-filter]').value;
		const availability = document.querySelector('[data-menu-availability-filter]').value;
		const visible = menuItems.filter((item) => {
			const matchesSearch = `${item.name} ${item.description} ${item.ingredients}`.toLocaleLowerCase('pt-PT').includes(search);
			return matchesSearch
				&& (!category || item.category === category)
				&& (availability === '' || String(item.available) === availability);
		});
		tableBody.replaceChildren();
		if (!visible.length) {
			const row = make('tr');
			const cell = make('td', '', 'Não foram encontrados pratos.');
			cell.colSpan = 6;
			row.append(cell);
			tableBody.append(row);
			return;
		}
		visible.forEach((item) => {
			const row = make('tr');
			const photoCell = make('td');
			const photo = make('img', 'menu-thumb');
			photo.src = item.image;
			photo.alt = item.name;
			photo.loading = 'lazy';
			photoCell.append(photo);
			const details = make('td');
			details.append(make('strong', '', item.name));
			if (item.description) details.append(make('small', '', item.description));
			const price = make('td', '', formatPrice(item.price));
			const categoryCell = make('td', '', item.category || '—');
			const availabilityCell = make('td');
			const toggleLabel = make('label', 'availability-toggle');
			const toggle = make('input');
			toggle.type = 'checkbox';
			toggle.checked = item.available;
			toggle.setAttribute('aria-label', `${item.available ? 'Indisponibilizar' : 'Disponibilizar'} ${item.name}`);
			toggle.addEventListener('change', async () => {
				toggle.disabled = true;
				try {
					await request(`/api/admin/menu/${item.id}/availability`, {
						method: 'PATCH',
						body: JSON.stringify({ available: toggle.checked }),
					});
					item.available = toggle.checked;
					renderMenu();
					toast('Disponibilidade atualizada.');
				} catch (error) {
					toggle.checked = item.available;
					toast(error.message, true);
				} finally {
					toggle.disabled = false;
				}
			});
			toggleLabel.append(toggle, make('span', '', item.available ? 'Disponível' : 'Indisponível'));
			availabilityCell.append(toggleLabel);
			const actions = make('td', 'management-row-actions');
			const edit = make('button', 'admin-button', 'Editar');
			edit.type = 'button';
			edit.addEventListener('click', () => editMenuItem(item));
			const remove = make('button', 'admin-button admin-button--danger', 'Remover');
			remove.type = 'button';
			remove.addEventListener('click', async () => {
				if (!window.confirm(`Remover o prato «${item.name}»? Esta operação não pode ser anulada.`)) return;
				remove.disabled = true;
				try {
					await request(`/api/admin/menu/${item.id}`, { method: 'DELETE' });
					menuItems = menuItems.filter((current) => current.id !== item.id);
					renderMenu();
					toast('Prato removido.');
				} catch (error) { toast(error.message, true); }
				finally { remove.disabled = false; }
			});
			actions.append(edit, remove);
			row.append(photoCell, details, price, categoryCell, availabilityCell, actions);
			tableBody.append(row);
		});
	}

	function updateMenuCategories() {
		const formSelect = document.querySelector('[data-menu-form] [name="category"]');
		const filterSelect = document.querySelector('[data-menu-category-filter]');
		formSelect.replaceChildren(new Option('Escolha uma categoria', ''));
		filterSelect.replaceChildren(new Option('Todas', ''));
		menuCategories.forEach((category) => {
			formSelect.add(new Option(category.name, category.name));
			filterSelect.add(new Option(category.name, category.name));
		});
	}

	async function loadMenu() {
		const feedback = document.querySelector('[data-menu-feedback]');
		feedback.textContent = 'A carregar os pratos…';
		try {
			const result = await request('/api/admin/menu', { method: 'GET', headers: {} });
			menuItems = result.items;
			menuCategories = result.categories;
			updateMenuCategories();
			renderMenu();
			feedback.textContent = result.importedItems
				? `${menuItems.length} prato(s) carregado(s); ${result.importedItems} prato(s) do site importado(s).`
				: `${menuItems.length} prato(s) carregado(s).`;
		} catch (error) { feedback.textContent = error.message; }
	}

	function editMenuItem(item) {
		const form = document.querySelector('[data-menu-form]');
		editingMenuId = item.id;
		form.elements.name.value = item.name;
		form.elements.category.value = item.category;
		form.elements.new_category.value = '';
		form.elements.price.value = item.price;
		form.elements.description.value = item.description;
		form.elements.ingredients.value = item.ingredients;
		form.elements.available.checked = item.available;
		form.elements.image.value = '';
		const preview = document.querySelector('[data-menu-image-preview]');
		preview.src = item.image;
		preview.hidden = !item.image;
		document.querySelector('[data-menu-form-title]').textContent = `Editar: ${item.name}`;
		document.querySelector('[data-menu-save]').textContent = 'Guardar alterações';
		document.querySelector('[data-menu-cancel]').hidden = false;
		form.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function resetMenuForm() {
		editingMenuId = null;
		const form = document.querySelector('[data-menu-form]');
		form.reset();
		form.elements.available.checked = true;
		document.querySelector('[data-menu-form-title]').textContent = 'Novo prato';
		document.querySelector('[data-menu-save]').textContent = 'Adicionar prato';
		document.querySelector('[data-menu-cancel]').hidden = true;
		document.querySelector('[data-menu-image-preview]').hidden = true;
	}

	function setupMenu() {
		const form = document.querySelector('[data-menu-form]');
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const button = document.querySelector('[data-menu-save]');
			const feedback = document.querySelector('[data-menu-feedback]');
			const data = new FormData(form);
			data.set('available', String(form.elements.available.checked));
			button.disabled = true;
			feedback.textContent = editingMenuId ? 'A guardar alterações…' : 'A adicionar o prato…';
			try {
				const method = editingMenuId ? 'PUT' : 'POST';
				const endpoint = editingMenuId ? `/api/admin/menu/${editingMenuId}` : '/api/admin/menu';
				await request(endpoint, { method, body: data });
				resetMenuForm();
				feedback.textContent = 'Prato guardado com sucesso.';
				await loadMenu();
				toast('Menu atualizado.');
			} catch (error) { feedback.textContent = error.message; }
			finally { button.disabled = false; }
		});
		document.querySelector('[data-menu-cancel]').addEventListener('click', resetMenuForm);
		document.querySelector('[data-menu-refresh]').addEventListener('click', loadMenu);
		document.querySelector('[data-menu-search]').addEventListener('input', renderMenu);
		document.querySelector('[data-menu-category-filter]').addEventListener('change', renderMenu);
		document.querySelector('[data-menu-availability-filter]').addEventListener('change', renderMenu);
		document.querySelector('[data-menu-image]').addEventListener('change', (event) => {
			const image = event.target.files[0];
			const preview = document.querySelector('[data-menu-image-preview]');
			if (!image) { preview.hidden = true; return; }
			preview.src = URL.createObjectURL(image);
			preview.hidden = false;
		});
	}

	const feedbackTypeLabels = {
		complaint: 'Reclamação', suggestion: 'Sugestão', praise: 'Elogio', other: 'Outro contacto',
	};
	const feedbackStatusLabels = { new: 'Nova', reviewing: 'Em análise', resolved: 'Resolvida' };

	function renderFeedback(submissions) {
		const list = document.querySelector('[data-feedback-list]');
		list.replaceChildren();
		if (!submissions.length) {
			list.append(make('p', 'feedback-empty', 'Não foram encontradas mensagens.'));
			return;
		}
		submissions.forEach((submission) => {
			const article = make('article', 'feedback-entry');
			const heading = make('div', 'feedback-entry-heading');
			const title = make('div');
			title.append(make('h3', '', submission.subject || feedbackTypeLabels[submission.type] || 'Mensagem'));
			title.append(make('p', 'feedback-entry-meta', `${submission.name} · ${feedbackTypeLabels[submission.type] || 'Outro contacto'} · ${submission.space || 'Espaço não indicado'}`));
			const received = new Date(submission.createdAt);
			heading.append(title, make('time', '', Number.isNaN(received.getTime()) ? submission.createdAt : received.toLocaleString('pt-PT')));
			const contact = make('p', 'feedback-contact', [submission.email, submission.phone].filter(Boolean).join(' · ') || 'Sem contacto fornecido');
			const content = make('details', 'feedback-message');
			const summary = make('summary', '', 'Ver mensagem completa e avaliações');
			const message = make('div', 'feedback-message-content');
			message.append(make('p', '', submission.message || 'Sem comentário adicional.'));
			const ratings = submission.answers || {};
			const ratingText = [
				['Atendimento', ratings.service_rating], ['Comida', ratings.food_rating], ['Ambiente', ratings.atmosphere_rating],
			].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}/5`).join(' · ');
			if (ratingText) message.append(make('p', '', ratingText));
			content.append(summary, message);
			const controls = make('div', 'feedback-entry-controls');
			const state = make('label', '');
			state.append(make('span', '', 'Estado'));
			const select = make('select');
			Object.entries(feedbackStatusLabels).forEach(([value, label]) => select.add(new Option(label, value)));
			select.value = feedbackStatusLabels[submission.status] ? submission.status : 'new';
			state.append(select);
			const notesLabel = make('label', 'feedback-notes');
			notesLabel.append(make('span', '', 'Notas internas'));
			const notes = make('textarea');
			notes.rows = 2;
			notes.maxLength = 10000;
			notes.value = submission.internalNotes;
			notesLabel.append(notes);
			const save = make('button', 'admin-button', 'Guardar estado e notas');
			save.type = 'button';
			save.addEventListener('click', async () => {
				save.disabled = true;
				try {
					await request(`/api/admin/feedback/${submission.id}`, {
						method: 'PATCH',
						body: JSON.stringify({ status: select.value, internalNotes: notes.value }),
					});
					submission.status = select.value;
					submission.internalNotes = notes.value;
					toast('Mensagem atualizada.');
					loadFeedback();
				} catch (error) { toast(error.message, true); }
				finally { save.disabled = false; }
			});
			controls.append(state, notesLabel, save);
			article.append(heading, contact, content, controls);
			list.append(article);
		});
	}

	async function loadFeedback() {
		const feedback = document.querySelector('[data-feedback-feedback]');
		feedback.textContent = 'A carregar as mensagens…';
		const params = new URLSearchParams();
		[
			['q', '[data-feedback-search]'], ['type', '[data-feedback-type]'],
			['status', '[data-feedback-status-filter]'], ['space', '[data-feedback-space]'],
			['date_from', '[data-feedback-date-from]'], ['date_to', '[data-feedback-date-to]'],
		].forEach(([key, selector]) => {
			const value = document.querySelector(selector).value.trim();
			if (value) params.set(key, value);
		});
		try {
			const result = await request(`/api/admin/feedback?${params}`, { method: 'GET', headers: {} });
			document.querySelector('[data-feedback-new-count]').textContent = result.counts.new;
			document.querySelector('[data-feedback-complaint-count]').textContent = result.counts.pendingComplaints;
			const spaces = document.querySelector('[data-feedback-space]');
			const selectedSpace = spaces.value;
			spaces.replaceChildren(new Option('Todos', ''));
			result.spaces.forEach((space) => spaces.add(new Option(space, space)));
			spaces.value = selectedSpace;
			renderFeedback(result.submissions);
			feedback.textContent = `${result.submissions.length} mensagem(ns) encontrada(s).`;
		} catch (error) { feedback.textContent = error.message; }
	}

	function setupFeedback() {
		document.querySelector('[data-feedback-refresh]').addEventListener('click', loadFeedback);
		['[data-feedback-type]', '[data-feedback-status-filter]', '[data-feedback-space]', '[data-feedback-date-from]', '[data-feedback-date-to]']
			.forEach((selector) => document.querySelector(selector).addEventListener('change', loadFeedback));
		document.querySelector('[data-feedback-search]').addEventListener('input', () => {
			clearTimeout(feedbackSearchTimer);
			feedbackSearchTimer = setTimeout(loadFeedback, 250);
		});
	}

	function setupNavigation() {
		document.querySelectorAll('[data-panel-target]').forEach((button) => button.addEventListener('click', () => {
			document.querySelectorAll('[data-panel-target]').forEach((item) => item.classList.toggle('is-active', item === button));
			document.querySelectorAll('[data-panel]').forEach((panel) => {
				const active = panel.dataset.panel === button.dataset.panelTarget;
				panel.hidden = !active;
				panel.classList.toggle('is-active', active);
			});
			const titles = {
                        editor: 'Editar páginas',
                        identity: 'Identidade e contactos',
						menu: 'Gestão do Menu',
						feedback: 'Fala Comigo',
                        reservations: 'Reservas'
                    };
                    document.querySelector('[data-view-title]').textContent =
                        titles[button.dataset.panelTarget] || 'Administração';
                    if (button.dataset.panelTarget === 'reservations') loadReservations();
					if (button.dataset.panelTarget === 'menu') loadMenu();
					if (button.dataset.panelTarget === 'feedback') loadFeedback();
		}));
		document.querySelector('[data-reservations-refresh]').addEventListener('click', loadReservations);
	}

	async function start() {
		try {
			const response = await request('/api/admin/site-content', { method: 'GET', headers: {} });
			Object.assign(content, response.content);
		} catch (error) { toast(error.message, true); return; }
		initializePagePicker();
		setupIdentity();
		setupMenu();
		setupFeedback();
		setupNavigation();
		document.querySelector('[data-save-page]').addEventListener('click', (event) => {
			clearTimeout(saveTimer);
			saveContent(document.querySelector('[data-save-state]'), event.currentTarget);
		});
		loadPage(activePage);
	}

	start();
})();