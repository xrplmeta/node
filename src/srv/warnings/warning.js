export function addTokenV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokenV1DeprecationWarning = {
            id: 'token_api_deprecation',
            message: 'token endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer HTTP /v2/token endpoint or WebSocket token command with api_version: 2 instead'
        }
        return {...response, warnings: [...warnings, tokenV1DeprecationWarning]}
    }
}

export function addTokensV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokensV1DeprecationWarning = {
            id: 'tokens_api_deprecation',
            message: 'tokens endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer HTTP /v2/tokens endpoint or WebSocket tokens command with api_version: 2 instead'
        }
        return {...response, warnings: [...warnings, tokensV1DeprecationWarning]}
    }
}

export function addTokenHoldersV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokenHoldersV1DeprecationWarning = {
            id: 'token_holders_api_deprecation',
            message: 'token/:token/holders endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer HTTP /v2/token/:token/holders endpoint or WebSocket token_holders command with api_version: 2 instead'
        }
        return {...response, warnings: [...warnings, tokenHoldersV1DeprecationWarning]}
    }
}

export function addServerInfoV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const serverInfoV1DeprecationWarning = {
            id: 'server_api_deprecation',
            message: 'server endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer HTTP /v2/server endpoint or WebSocket server_info command with api_version: 2 instead'
        }
        return {...response, warnings: [...warnings, serverInfoV1DeprecationWarning]}
    }
}

export function addLedgerV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const ledgerV1DeprecationWarning = {
            id: 'ledger_api_deprecation',
            message: 'ledger endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer HTTP /v2/ledger endpoint or WebSocket ledger command with api_version: 2 instead'
        }
        return {...response, warnings: [...warnings, ledgerV1DeprecationWarning]}
    }
}

export function addTokenExchangesV1DeprecationWarning(){
    return response => {
        let warnings = response.warnings || []
        const tokenExchangesV1DeprecationWarning = {
            id: 'token_exchanges_api_deprecation',
            message: 'tokens/exchanges endpoint is being deprecated and will be removed on MM-DD-YYYY. Prefer HTTP /v2/tokens/exchanges endpoint or WebSocket token_exchanges command with api_version: 2 instead'
        }
        return {...response, warnings: [...warnings, tokenExchangesV1DeprecationWarning]}
    }
}