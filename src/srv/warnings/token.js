export function addTokenV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokenV1DeprecationWarning = {
            id: 'token_api_deprecation',
            message: '/token endpoint is being deprecated and will be removed on December 31, 2026. Prefer /v2/token endpoint instead'
        }
        return {...response, warnings: [...warnings, tokenV1DeprecationWarning]}
    }
}

export function addTokensV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokensV1DeprecationWarning = {
            id: 'tokens_api_deprecation',
            message: '/tokens endpoint is being deprecated and will be removed on December 31, 2026. Prefer /v2/tokens endpoint instead'
        }
        return {...response, warnings: [...warnings, tokensV1DeprecationWarning]}
    }
}