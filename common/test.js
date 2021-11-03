import { deriveExchanges } from './xrpl.js'

console.log(deriveExchanges(JSON.parse(`{
    "Account": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
    "Expiration": 717930106,
    "Fee": "12",
    "Flags": 2147483648,
    "LastLedgerSequence": 66729951,
    "Sequence": 60852193,
    "SigningPubKey": "02273713CEAC552CD26CE40BCC2DAF411E7692C9A3452397CCE6C69085590A2A24",
    "TakerGets": "1730000",
    "TakerPays": {
        "currency": "50414C454F434F494E0000000000000000000000",
        "issuer": "rPfuLd1XmVyxkggAiT9fpLQU81GLb6UDZg",
        "value": "5000"
    },
    "TransactionType": "OfferCreate",
    "TxnSignature": "3045022100B2A91B84791D3222BCA0897004F3B85DD51510525C6695E2CB34271E8E0B0173022021D623101819694198581F0547943DED64FC250E663B4BE2E2A3ED1FFE8555B6",
    "date": 686394120,
    "hash": "8B77024F8E1D7B0675E4F5F47ADA91DCE0326F6B74BE5AB074E063DBEB779A28",
    "inLedger": 66729910,
    "ledger_index": 66729910,
    "meta": {
        "AffectedNodes": [
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "5000"
                        },
                        "Flags": 1114112,
                        "HighLimit": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rPfuLd1XmVyxkggAiT9fpLQU81GLb6UDZg",
                            "value": "0"
                        },
                        "HighNode": "169",
                        "LowLimit": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
                            "value": "50101000100.1206"
                        },
                        "LowNode": "0"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "01878ECE3F3D269BDA45D64C787C564204E876E490524C0FD2117A32823E60C3",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "0"
                        }
                    },
                    "PreviousTxnID": "D415BFB4689F3C8A4E3DC47F0ED990B1A09A212C815BE00BA859FAFCA565FDB6",
                    "PreviousTxnLgrSeq": 66729881
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "r9MDUnXQfdKkVrZgDxbPiXUSgvjTPh35dS",
                        "Balance": "639725089",
                        "Flags": 0,
                        "OwnerCount": 46,
                        "Sequence": 66665734
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "0712B259EA9F0E7CB8AC489530739ED4D2D023472DEA27DB2C91BE4182A05A96",
                    "PreviousFields": {
                        "Balance": "637998076"
                    },
                    "PreviousTxnID": "61429A48194294E11B4598938184DCA52A818E22FD5CBAFAC12EB589F36C9F80",
                    "PreviousTxnLgrSeq": 66729909
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "63602.16283696449"
                        },
                        "Flags": 1114112,
                        "HighLimit": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rPfuLd1XmVyxkggAiT9fpLQU81GLb6UDZg",
                            "value": "0"
                        },
                        "HighNode": "a7",
                        "LowLimit": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "r9MDUnXQfdKkVrZgDxbPiXUSgvjTPh35dS",
                            "value": "50101000100.12065"
                        },
                        "LowNode": "3"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "462ED8453A96A4DC9E4563E3DBC7EFBFB7617DF5517FC2013E7F7A87BDADC18C",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "68602.16283696449"
                        }
                    },
                    "PreviousTxnID": "FA74BA1B1F9EE9D8733300F6FEFA0D71FD4212F9CB103282D155FF0615CAE58D",
                    "PreviousTxnLgrSeq": 66729891
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "r9MDUnXQfdKkVrZgDxbPiXUSgvjTPh35dS",
                        "BookDirectory": "D789027409431F30432ACF4D8FEE442E97727603868BFE20570C456ABE837D5D",
                        "BookNode": "0",
                        "Flags": 0,
                        "OwnerNode": "7",
                        "Sequence": 66665728,
                        "TakerGets": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rPfuLd1XmVyxkggAiT9fpLQU81GLb6UDZg",
                            "value": "60840.69711831843"
                        },
                        "TakerPays": "21014525"
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "65AEB2C12DF5E99A231DB9C9B530210237AA9EE8401030FC09EA90489A46C72D",
                    "PreviousFields": {
                        "TakerGets": {
                            "currency": "50414C454F434F494E0000000000000000000000",
                            "issuer": "rPfuLd1XmVyxkggAiT9fpLQU81GLb6UDZg",
                            "value": "65840.69711831843"
                        },
                        "TakerPays": "22741538"
                    },
                    "PreviousTxnID": "FA74BA1B1F9EE9D8733300F6FEFA0D71FD4212F9CB103282D155FF0615CAE58D",
                    "PreviousTxnLgrSeq": 66729891
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
                        "Balance": "29925352801",
                        "Flags": 0,
                        "OwnerCount": 23,
                        "Sequence": 60852194
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "D762B5BB653CCFCCF592FCA049B2046E4E56A5939AA774EB52ED008ACDCFD0C8",
                    "PreviousFields": {
                        "Balance": "29927079826",
                        "Sequence": 60852193
                    },
                    "PreviousTxnID": "D415BFB4689F3C8A4E3DC47F0ED990B1A09A212C815BE00BA859FAFCA565FDB6",
                    "PreviousTxnLgrSeq": 66729881
                }
            }
        ],
        "TransactionIndex": 34,
        "TransactionResult": "tesSUCCESS"
    },
    "validated": true
}`)))