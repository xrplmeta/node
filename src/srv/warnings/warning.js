export function addTokenV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokenV1DeprecationWarning = {
            id: 'token_api_deprecation',
            message: '/token endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer /v2/token endpoint instead'
        }
        return {...response, warnings: [...warnings, tokenV1DeprecationWarning]}
    }
}

export function addTokensV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokensV1DeprecationWarning = {
            id: 'tokens_api_deprecation',
            message: '/tokens endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer /v2/tokens endpoint instead'
        }
        return {...response, warnings: [...warnings, tokensV1DeprecationWarning]}
    }
}

export function addTokenHoldersV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokenHoldersV1DeprecationWarning = {
            id: 'token_holders_api_deprecation',
            message: '/token/:token/holders endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer /v2/token/:token/holders endpoint instead'
        }
        return {...response, warnings: [...warnings, tokenHoldersV1DeprecationWarning]}
    }
}

export function addServerInfoV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const serverInfoV1DeprecationWarning = {
            id: 'server_info_api_deprecation',
            message: '/info and /server endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer /v2/info and /v2/server endpoint instead'
        }
        return {...response, warnings: [...warnings, serverInfoV1DeprecationWarning]}
    }
}

export function addLedgerV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const ledgerV1DeprecationWarning = {
            id: 'ledger_api_deprecation',
            message: '/ledger endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer /v2/ledger endpoint instead'
        }
        return {...response, warnings: [...warnings, ledgerV1DeprecationWarning]}
    }
}