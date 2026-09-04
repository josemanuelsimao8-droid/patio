const lightbox = document.querySelector('[data-lightbox]');
const galleryImages = [...document.querySelectorAll('[data-gallery] img')];
let currentImage = 0;

if (lightbox && galleryImages.length) {
	const image = lightbox.querySelector('img');
	const show = (index) => {
		currentImage = (index + galleryImages.length) % galleryImages.length;
		image.src = galleryImages[currentImage].src;
		image.alt = galleryImages[currentImage].alt;
		lightbox.classList.remove('hidden');
	};

	galleryImages.forEach((item, index) => {
		item.addEventListener('click', () => show(index));
	});
	lightbox.querySelector('[data-close]').addEventListener('click', () => lightbox.classList.add('hidden'));
	lightbox.querySelector('[data-prev]').addEventListener('click', () => show(currentImage - 1));
	lightbox.querySelector('[data-next]').addEventListener('click', () => show(currentImage + 1));

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') lightbox.classList.add('hidden');
		if (event.key === 'ArrowLeft') show(currentImage - 1);
		if (event.key === 'ArrowRight') show(currentImage + 1);
	});
}
