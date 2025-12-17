import { expect } from 'chai'
import { issuerFromMPTIssuanceId, mptIssuanceIdFromIssuerAndSequence } from '../../src/xrpl/mpt.js'

describe("MPT parsing tests",
    () => {
        it(
            "extract issuer from mptIssuanceId",
            () => {
                const mptIssuanceId = '000525D8BE61F040420DB5A4CBA0577A70E6BD013E75E00D'
                const issuerId = issuerFromMPTIssuanceId(mptIssuanceId)
                expect(issuerId).to.be.equal('rJMe5LJDEPZjJD5zubetbZ2UJP2gEoHEAv')
            }
        )

        it(
            "mptIssuanceId from issuer and sequence",
            () => {
                const mptIssuanceId = mptIssuanceIdFromIssuerAndSequence('r32Jav7gcjJbVzbAMVdUXjUZGj2EFt6A2b', 346663)
                expect(mptIssuanceId).to.be.equal('00054A275314E222C1703C0E399C66591F56EED073247259')
            }
        )
    }
)