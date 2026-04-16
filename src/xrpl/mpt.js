import { decodeAccountID, encodeAccountID } from "ripple-address-codec"
import TokenType from './tokentype.js'

export function isValidMPTIssuanceId(mptIssuanceId){
    return /^[A-Z0-9]{48}$/.test(mptIssuanceId)
}

export function issuerFromMPTIssuanceId(mptIssuanceId){
    const issuerHex = mptIssuanceId.slice(8)
    return encodeAccountID(Buffer.from(issuerHex, 'hex'))
}

export function mptIssuanceIdFromIssuerAndSequence(issuer, sequence){
    const sequenceBuffer = new Uint8Array(4)
    new DataView(sequenceBuffer.buffer).setUint32(0, sequence, false)

    const issuerBuffer = decodeAccountID(issuer)
    const combinedBuffer = Buffer.concat([Buffer.from(sequenceBuffer), issuerBuffer])

    return combinedBuffer.toString('hex').toUpperCase()
}