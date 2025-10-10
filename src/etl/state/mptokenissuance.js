import log from '@mwni/log'

function hexToString(hex) {
    return Buffer.from(hex, 'hex').toString('utf8');
}

function parseMPTokenMetadata(hexInput) {
    if (!hexInput)
        return {}

    try {
        return JSON.parse(hexToString(hexInput))
    } catch (err) {
        log.warn(`Error parsing - hex: ${hexInput} - string: ${hexToString(hexInput)}`);    
    }
    
    return {}
}

export function parse({entry}) {
    return {
        issuer: entry.Issuer, 
        mptIssuanceId: entry.mpt_issuance_id,
        metaData: parseMPTokenMetadata(entry.MPTokenMetadata)
    }
}

// TODO
export function diff({ ctx, previous, final }){
    
}