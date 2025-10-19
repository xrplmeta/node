import { expect } from 'chai'
import { accountFromMPTIssuanceId } from '../../src/xrpl/mpt.js'

describe("MPT specific unit tests",
    () => {
        it(
            "test extract address from mptIssuance_Id",
            () => {
                const mptIssuanceId = '000525D8BE61F040420DB5A4CBA0577A70E6BD013E75E00D'
                const accountId = accountFromMPTIssuanceId(mptIssuanceId)
                expect(accountId).to.be.equal('rJMe5LJDEPZjJD5zubetbZ2UJP2gEoHEAv')
            }
        )
    }
)