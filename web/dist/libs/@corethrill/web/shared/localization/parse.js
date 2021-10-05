import parseTxt from './txt.js'
import YAML from 'yaml'

export default {
	text: parseTxt,
	yaml: yaml => {
		return YAML.parse(yaml)
	}
}