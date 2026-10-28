(function () {
	const pageName = window.location.pathname.split('/').pop() || 'index.html';
	const layoutNames = ['cms-layout-copy-left', 'cms-layout-copy-right', 'cms-layout-full'];
	let content = { brand: {}, pages: {} };
	let contentSignature = '';

	function pageSections() {
		const main = document.querySelector('main');
		if (!main) return [];
		return [...main.children].filter((element) => element.tagName === 'SECTION');
	}

	function collectTextNodes(section) {
		const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
		const nodes = [];
		let node;
		while ((node = walker.nextNode())) {
			const parent = node.parentElement;
			if (!node.nodeValue.trim() || parent.closest('script, style, noscript, svg, [aria-hidden="true"], .hero-nav, .icon-btn')) continue;
			nodes.push(node);
		}
		return nodes;
	}

	function collectFields(section) {
		const candidates = [...section.querySelectorAll('h1, h2, h3, h4, p, figcaption, .space-caption span, .text-link')];
		return candidates.filter((element) => [...element.children].every((child) => child.tagName === 'BR'));
	}

	function collectBackgroundImages(section) {
		const elements = [section, ...section.querySelectorAll('*')];
		return elements.filter((element) => /url\(/i.test(element.style.backgroundImage));
	}

	function applyBrand(brand) {
		if (!brand) return;
		if (typeof brand.title === 'string') document.title = brand.title;
		const titleMeta = document.querySelector('meta[property="og:title"]');
		if (titleMeta && typeof brand.title === 'string') titleMeta.content = brand.title;
		const logos = document.querySelectorAll('.brand-logo, .footer-logo');
		logos.forEach((image) => {
			if (typeof brand.logo === 'string') image.src = brand.logo;
			if (typeof brand.name === 'string') image.alt = brand.name;
		});
		const wordmark = document.querySelector('.wordmark');
		if (wordmark && typeof brand.name === 'string') wordmark.setAttribute('aria-label', `${brand.name}, início`);
		const heroTitle = document.querySelector('[data-hero-title]');
		if (heroTitle && typeof brand.heroTitle === 'string') heroTitle.textContent = brand.heroTitle;
		const heroSubtitle = document.querySelector('.hero-content .lede');
		if (heroSubtitle && typeof brand.heroSubtitle === 'string') heroSubtitle.textContent = brand.heroSubtitle;
		const footer = document.querySelector('.site-footer');
		if (footer) {
			const footerText = footer.querySelector('.footer-grid > div:first-child > p');
			if (footerText && typeof brand.heroSubtitle === 'string') footerText.textContent = brand.heroSubtitle;
			const socialLinks = footer.querySelectorAll('.socials a');
			if (socialLinks[0] && typeof brand.instagram === 'string') socialLinks[0].href = brand.instagram;
			if (socialLinks[1] && typeof brand.facebook === 'string') socialLinks[1].href = brand.facebook;
			footer.querySelectorAll('a[href^="tel:"]').forEach((link) => {
				if (typeof brand.phone === 'string') { link.href = `tel:${brand.phone.replace(/\s/g, '')}`; link.textContent = brand.phone; }
			});
			footer.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
				if (typeof brand.email === 'string') { link.href = `mailto:${brand.email}`; link.textContent = brand.email; }
			});
			const hours = footer.querySelector('.footer-grid > div:last-child > p');
			if (hours && typeof brand.hours === 'string') hours.textContent = brand.hours;
		}
	}

	function applyPage(pageData) {
		const sections = pageSections();
		sections.forEach((section, index) => {
			const key = section.dataset.cmsSectionKey || section.id || `section-${index + 1}`;
			section.dataset.cmsSectionKey = key;
			const data = pageData?.sections?.[key];
			if (!data) return;
			section.hidden = data.visible === false;
			section.classList.remove(...layoutNames);
			if (data.layout && data.layout !== 'original') section.classList.add(`cms-layout-${data.layout}`);
			if (data.fieldsVersion === 2) {
				collectTextNodes(section).forEach((node, fieldIndex) => {
					const replacement = data.fields?.[fieldIndex];
					if (typeof replacement === 'string') node.nodeValue = replacement;
				});
			} else {
				collectFields(section).forEach((field, fieldIndex) => {
					const replacement = data.fields?.[fieldIndex];
					if (typeof replacement === 'string') field.textContent = replacement;
				});
			}
			[...section.querySelectorAll('img')].forEach((image, imageIndex) => {
				const replacement = data.images?.[imageIndex];
				if (!replacement) return;
				if (typeof replacement.src === 'string') image.src = replacement.src;
				if (typeof replacement.alt === 'string') image.alt = replacement.alt;
			});
			collectBackgroundImages(section).forEach((element, imageIndex) => {
				const replacement = data.backgrounds?.[imageIndex]?.src;
				if (typeof replacement !== 'string') return;
				element.style.backgroundImage = element.style.backgroundImage.replace(
					/url\((['"]?)(.*?)\1\)/i,
					`url("${replacement.replace(/"/g, '%22')}")`,
				);
			});
			[...section.querySelectorAll('video source')].forEach((video, videoIndex) => {
				const replacement = data.videos?.[videoIndex];
				if (typeof replacement === 'string') {
					video.src = replacement;
					video.parentElement.load();
				}
			});

			[...section.querySelectorAll('a')].forEach((link, linkIndex) => {
				const destination = data.links?.[linkIndex];
				if (typeof destination !== 'string') return;
				const value = destination.trim();
				const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
				const allowedScheme = /^(https?:|mailto:|tel:)/i.test(value);
				if (hasScheme && !allowedScheme) {
					link.removeAttribute('href');
					return;
				}
				if (value) link.setAttribute('href', value);
				else link.removeAttribute('href');
			});
		});

		const order = pageData?.order;
		if (Array.isArray(order) && order.length) {
			const main = document.querySelector('main');
			const byKey = new Map(sections.map((section) => [section.dataset.cmsSectionKey, section]));
			const sorted = [...order.map((key) => byKey.get(key)).filter(Boolean), ...sections.filter((section) => !order.includes(section.dataset.cmsSectionKey))];
			const fragment = document.createDocumentFragment();
			sorted.forEach((section) => fragment.appendChild(section));
			main.prepend(fragment);
		}
	}

	async function loadContent() {
		const stylesheet = document.createElement('link');
		stylesheet.rel = 'stylesheet';
		stylesheet.href = '/static/cms.css';
		document.head.append(stylesheet);
		const response = await fetch('/api/site-content', { cache: 'no-store' });
		if (!response.ok) throw new Error('Não foi possível carregar as alterações do site.');
		content = await response.json();
		contentSignature = JSON.stringify(content);
		await new Promise((resolve) => {
			if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve, { once: true });
			else resolve();
		});
		applyBrand(content.brand);
		applyPage(content.pages?.[pageName]);
		window.setTimeout(() => applyPage(content.pages?.[pageName]), 650);
		window.setInterval(async () => {
			if (document.hidden) return;
			try {
				const update = await fetch('/api/site-content', { cache: 'no-store' });
				if (!update.ok) throw new Error('Não foi possível verificar as alterações do site.');
				const nextContent = await update.json();
				const signature = JSON.stringify(nextContent);
				if (signature === contentSignature) return;
				content = nextContent;
				contentSignature = signature;
				applyBrand(content.brand);
				applyPage(content.pages?.[pageName]);
			} catch (error) {
				console.error(error);
			}
		}, 2500);
	}

	window.applySiteCms = (nextContent) => {
		content = nextContent;
		contentSignature = JSON.stringify(content);
		applyBrand(content.brand);
		applyPage(content.pages?.[pageName]);
	};
	window.siteCmsReady = loadContent();
})();