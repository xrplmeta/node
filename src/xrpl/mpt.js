import { encodeAccountID } from "ripple-address-codec"

export function accountFromMPTIssuanceId(mptIssuanceId) {
    const accountHex = mptIssuanceId.slice(8)
    return encodeAccountID(Buffer.from(accountHex, 'hex'))
}