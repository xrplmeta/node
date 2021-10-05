
function isOriginSameAsLocation(url) {
  var pageLocation = window.location;
  var URL_HOST_PATTERN = /(\w+:)?(?:\/\/)([\w.-]+)?(?::(\d+))?\/?/;
  var urlMatch = URL_HOST_PATTERN.exec(url) || [];
  var urlparts = {
      protocol:   urlMatch[1] || '',
      host:       urlMatch[2] || '',
      port:       urlMatch[3] || ''
  };

  function defaultPort(protocol) {
     return {'http:':80, 'https:':443}[protocol];
  }

  function portOf(location) {
     return location.port || defaultPort(location.protocol||pageLocation.protocol);
  }

  return !!(  (urlparts.protocol  && (urlparts.protocol  == pageLocation.protocol)) &&
              (urlparts.host     && (urlparts.host      == pageLocation.host))     &&
              (urlparts.host     && (portOf(urlparts) == portOf(pageLocation)))
          );
}

export { isOriginSameAsLocation }