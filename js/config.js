const WHATSAPP_NUMBER = '244941180424';

const PATIO = {
	name: 'Pátio Luanda',
	phone: '+244 941 180 424',
	email: 'ola@patioluanda.co.ao',
	hours: 'Terça a domingo · 12h — 23h',
	instagram: 'https://www.instagram.com/',
	facebook: 'https://www.facebook.com/',
	spaces: [
		{ id: 'morrobento', name: 'Pátio Morro Bento', short: 'Morro Bento', href: 'morrobento.html' },
		{ id: 'pastelaria', name: 'Pastelaria Pátio', short: 'Pastelaria', href: 'espacos.html#pastelaria' },
		{ id: 'mutamba', name: 'Pátio Mutamba', short: 'Mutamba', href: 'mutamba.html' },
		{ id: 'roots', name: 'Roots by Pátio Luanda', short: 'Roots', href: 'roots.html' },
		{ id: 'aeroporto', name: 'Pátio Aeroporto', short: 'Aeroporto', href: 'espacos.html#aeroporto' },
	],
	locations: {
		morrobento: {
			name: 'Pátio Morro Bento',
			address: 'Av. Pedro de Castro Van-Dúnem Loy, Morro Bento, Luanda',
			image: 'assets/images/morro-bento/1P2A0114 - Cópia.jpg',
			map: 'https://www.google.com/maps?q=Morro+Bento+Luanda&output=embed',
			mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Morro+Bento+Luanda',
		},
		pastelaria: {
			name: 'Pastelaria Pátio',
			address: 'Morro Bento, Luanda',
			image: 'assets/images/prato6.jpg',
			map: 'https://www.google.com/maps?q=Pastelaria+Patio+Morro+Bento+Luanda&output=embed',
			mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Pastelaria+Patio+Morro+Bento+Luanda',
		},
		mutamba: {
			name: 'Pátio Mutamba',
			address: 'Mutamba, Luanda',
			image: 'assets/images/mutamba/1P2A3031.jpg',
			map: 'https://www.google.com/maps?q=Mutamba+Luanda&output=embed',
			mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mutamba+Luanda',
		},
		roots: {
			name: 'Roots by Pátio Luanda',
			address: 'Luanda',
			image: 'assets/images/2.jpg',
			map: 'https://www.google.com/maps?q=Luanda+restaurante&output=embed',
			mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Roots+by+Patio+Luanda',
		},
		aeroporto: {
			name: 'Pátio Aeroporto',
			address: 'Aeroporto, Luanda',
			map: 'https://www.google.com/maps?q=Patio+Aeroporto+Luanda&output=embed',
			mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Patio+Aeroporto+Luanda',
		},
	},
};

function patioWhatsAppUrl(message) {
	const text = message || 'Olá, Pátio Luanda. Gostaria de obter mais informações.';
	return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function patioPageWhatsAppMessage() {
	const file = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
	if (file === 'eventos' || file === 'clientes') {
		return 'Olá, Pátio Luanda. Gostaria de informações sobre eventos.';
	}
	if (file === 'reserva' || file === 'reservas') {
		return 'Olá, Pátio Luanda. Gostaria de fazer uma reserva.';
	}
	return 'Olá, Pátio Luanda. Gostaria de obter mais informações.';
}
