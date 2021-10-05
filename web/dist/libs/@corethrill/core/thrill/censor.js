var magic = /^(?:key|oninit|oncreate|onbeforeupdate|onupdate|onbeforeremove|onremove)$/

export default function(attrs, extras) {
	var result = {}

	if (extras != null) {
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key) && !magic.test(key) && extras.indexOf(key) < 0) {
				result[key] = attrs[key]
			}
		}
	} else {
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key) && !magic.test(key)) {
				result[key] = attrs[key]
			}
		}
	}

	return result
}
