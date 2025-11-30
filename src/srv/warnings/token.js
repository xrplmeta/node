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