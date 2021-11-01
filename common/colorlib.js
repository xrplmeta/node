export default {
	hexToRgb(hex) {
		let i = parseInt(hex.replace('#', ''), 16)
		let r = (i >> 16) & 255
		let g = (i >> 8) & 255
		let b = i & 255

		return {r, g, b}
	},

	rgbToHsv({r, g, b}) {
		r /= 255
		g /= 255
		b /= 255

		let max = Math.max(r, g, b)
		let min = Math.min(r, g, b)
		let h, s, v = max

		let d = max - min
		
		s = max == 0 ? 0 : d / max

		if (max == min){
			h = 0;
		}else{
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}

			h /= 6;
		}

		return {h, s, v}
	},

	hsvToRgb({h, s, v}) {
		var r, g, b;

		var i = Math.floor(h * 6);
		var f = h * 6 - i;
		var p = v * (1 - s);
		var q = v * (1 - f * s);
		var t = v * (1 - (1 - f) * s);

		switch (i % 6) {
			case 0: r = v, g = t, b = p; break;
			case 1: r = q, g = v, b = p; break;
			case 2: r = p, g = v, b = t; break;
			case 3: r = p, g = q, b = v; break;
			case 4: r = t, g = p, b = v; break;
			case 5: r = v, g = p, b = q; break;
		}

		return {r: r * 255, g: g * 255, b: b * 255}
	}
}
