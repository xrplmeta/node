import { deriveExchanges } from './xrpl.js'




console.log(deriveExchanges(JSON.parse(`{
    "Account": "rogue5HnPRSszD9CWGSUz8UGHMVwSSKF6",
    "Amount": "15237797",
    "Destination": "rogue5HnPRSszD9CWGSUz8UGHMVwSSKF6",
    "Fee": "10",
    "Flags": 196608,
    "LastLedgerSequence": 67711105,
    "Paths": [
        [
            {
                "currency": "5348494200000000000000000000000000000000",
                "issuer": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                "type": 48
            },
            {
                "account": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                "type": 1
            }
        ]
    ],
    "SendMax": {
        "currency": "534F4C4F00000000000000000000000000000000",
        "issuer": "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
        "value": "0.00152530501525"
    },
    "Sequence": 2859556,
    "SigningPubKey": "ED3DC1A8262390DBA0E9926050A7BE377DFCC7937CC94C5F5F24E6BD97D677BA6C",
    "TransactionType": "Payment",
    "TxnSignature": "F7466696A8870E482D57E443156279BD659FA30D512C2602F3ABFA3113232BFA62002CC558DD163D82318CD12B15B227790A12F6D5ED7833CC1F6C1E0720FF01",
    "date": 690275681,
    "hash": "D1605EB47E3F98AA20901F2F03DFFA4DB7505E6109E3A7979B02A08A2DDC9198",
    "inLedger": 67711105,
    "ledger_index": 67711105,
    "meta": {
        "AffectedNodes": [
            {
                "DeletedNode": {
                    "FinalFields": {
                        "Account": "rKqnz7rS3Bo1EMuS3N2aa867wzEeTtFXph",
                        "BookDirectory": "C5F9F728A161EA262EEDFA6D3F1552A1C67FBD415E8D5C6055038D7EA4C68000",
                        "BookNode": "0",
                        "Flags": 0,
                        "OwnerNode": "1",
                        "PreviousTxnID": "C7274F66D3503D2A56866EBBEA5F77D54A467E462C26895E19D0B1E01FDB2139",
                        "PreviousTxnLgrSeq": 67711082,
                        "Sequence": 66024100,
                        "TakerGets": "0",
                        "TakerPays": {
                            "currency": "5348494200000000000000000000000000000000",
                            "issuer": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                            "value": "0"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "02FFF9C0C448DFCD470B49FCE926EDBACF73D5B069C41E1FFE16F46F297589F3",
                    "PreviousFields": {
                        "TakerGets": "2",
                        "TakerPays": {
                            "currency": "5348494200000000000000000000000000000000",
                            "issuer": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                            "value": "2.61030396"
                        }
                    }
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rKqnz7rS3Bo1EMuS3N2aa867wzEeTtFXph",
                        "Balance": "737424598",
                        "Flags": 8388608,
                        "OwnerCount": 51,
                        "Sequence": 66024102
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "71EBBA4FC0B904CACA7B4CFC1CAB7109792CFA5AD1173ADD305941E9E47492D6",
                    "PreviousFields": {
                        "Balance": "752662395",
                        "OwnerCount": 52
                    },
                    "PreviousTxnID": "50DF3D02F1FADF78D84F4F0CFCDC14D85023E4CC8E3D5B569B97F48A7CB8D75D",
                    "PreviousTxnLgrSeq": 67711103
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rKqnz7rS3Bo1EMuS3N2aa867wzEeTtFXph",
                        "BookDirectory": "C5F9F728A161EA262EEDFA6D3F1552A1C67FBD415E8D5C6055038D7EA4C68000",
                        "BookNode": "0",
                        "Flags": 0,
                        "OwnerNode": "1",
                        "Sequence": 66024101,
                        "TakerGets": "12205",
                        "TakerPays": {
                            "currency": "5348494200000000000000000000000000000000",
                            "issuer": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                            "value": "12205"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "88D3F17BD13161C6004F4D0788F7949796CE4317CD0241F5E9A5366EA358E1E7",
                    "PreviousFields": {
                        "TakerGets": "15250000",
                        "TakerPays": {
                            "currency": "5348494200000000000000000000000000000000",
                            "issuer": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                            "value": "15250000"
                        }
                    },
                    "PreviousTxnID": "50DF3D02F1FADF78D84F4F0CFCDC14D85023E4CC8E3D5B569B97F48A7CB8D75D",
                    "PreviousTxnLgrSeq": 67711103
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Flags": 0,
                        "Owner": "rKqnz7rS3Bo1EMuS3N2aa867wzEeTtFXph",
                        "RootIndex": "B11AA8BC9B3E1B979DCF3C59D7E914B6467FF5988E5E931586825815BDE260BA"
                    },
                    "LedgerEntryType": "DirectoryNode",
                    "LedgerIndex": "928753CF7ED0CDCBFC9C10BFD07364E97AE0D35532C21AC4DFFC91782226BED2"
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-0.0027737795"
                        },
                        "Flags": 2228224,
                        "HighLimit": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rKqnz7rS3Bo1EMuS3N2aa867wzEeTtFXph",
                            "value": "399962576.020014"
                        },
                        "HighNode": "0",
                        "LowLimit": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
                            "value": "0"
                        },
                        "LowNode": "ae"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "B033A9ED24C9BCDDD7A2FD27AFD2E8A20E99617F229662A304715F7D418DE150",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-0.001249999738969604"
                        }
                    },
                    "PreviousTxnID": "C7274F66D3503D2A56866EBBEA5F77D54A467E462C26895E19D0B1E01FDB2139",
                    "PreviousTxnLgrSeq": 67711082
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "0.000001583173455259"
                        },
                        "Flags": 1114112,
                        "HighLimit": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
                            "value": "0"
                        },
                        "HighNode": "e45",
                        "LowLimit": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rogue5HnPRSszD9CWGSUz8UGHMVwSSKF6",
                            "value": "0"
                        },
                        "LowNode": "9"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "BA9E86D8B2B5BB0E42AB2A482BDA4799A8781CA2DAD2B1307A2F10472F322523",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "0.001525515312461759"
                        }
                    },
                    "PreviousTxnID": "5976CFD95FE12D9B97DE625360D76E4108988BCC34867FB1FDA07FB7539E5910",
                    "PreviousTxnLgrSeq": 67711105
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "ExchangeRate": "55038d7ea4c68000",
                        "Flags": 0,
                        "RootIndex": "C5F9F728A161EA262EEDFA6D3F1552A1C67FBD415E8D5C6055038D7EA4C68000",
                        "TakerGetsCurrency": "0000000000000000000000000000000000000000",
                        "TakerGetsIssuer": "0000000000000000000000000000000000000000",
                        "TakerPaysCurrency": "5348494200000000000000000000000000000000",
                        "TakerPaysIssuer": "3EDC51C98C986B3A55E66859A7B3593EAFFAAD23"
                    },
                    "LedgerEntryType": "DirectoryNode",
                    "LedgerIndex": "C5F9F728A161EA262EEDFA6D3F1552A1C67FBD415E8D5C6055038D7EA4C68000"
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rKqnz7rS3Bo1EMuS3N2aa867wzEeTtFXph",
                        "BookDirectory": "A501CAB7404B4259E2C712C491946A4A17488998AA79B79F4B038D7EA4C68000",
                        "BookNode": "0",
                        "Flags": 131072,
                        "OwnerNode": "1",
                        "Sequence": 66024098,
                        "TakerGets": {
                            "currency": "5348494200000000000000000000000000000000",
                            "issuer": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                            "value": "1249999722622051e-1"
                        },
                        "TakerPays": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
                            "value": "12499.99722622051"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "E0A32EB3E7E6721250B60426F815F093B01C6C4B6D562A8FC0C48E866FECE373",
                    "PreviousFields": {
                        "TakerGets": {
                            "currency": "5348494200000000000000000000000000000000",
                            "issuer": "raj4FxeZfWQiFkNR2iwSgfwEMBMrvtdoW9",
                            "value": "1249999875000027e-1"
                        },
                        "TakerPays": {
                            "currency": "534F4C4F00000000000000000000000000000000",
                            "issuer": "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
                            "value": "12499.99875000027"
                        }
                    },
                    "PreviousTxnID": "C7274F66D3503D2A56866EBBEA5F77D54A467E462C26895E19D0B1E01FDB2139",
                    "PreviousTxnLgrSeq": 67711082
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rogue5HnPRSszD9CWGSUz8UGHMVwSSKF6",
                        "AccountTxnID": "D1605EB47E3F98AA20901F2F03DFFA4DB7505E6109E3A7979B02A08A2DDC9198",
                        "Balance": "10721831237",
                        "Flags": 0,
                        "OwnerCount": 181,
                        "Sequence": 2859557
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "E7C799A822859C2DC1CA293CB3136B6590628B19F81D5C7BA8752B49BB422E84",
                    "PreviousFields": {
                        "AccountTxnID": "5976CFD95FE12D9B97DE625360D76E4108988BCC34867FB1FDA07FB7539E5910",
                        "Balance": "10706593450",
                        "Sequence": 2859556
                    },
                    "PreviousTxnID": "5976CFD95FE12D9B97DE625360D76E4108988BCC34867FB1FDA07FB7539E5910",
                    "PreviousTxnLgrSeq": 67711105
                }
            }
        ],
        "TransactionIndex": 68,
        "TransactionResult": "tesSUCCESS",
        "delivered_amount": "15237797"
    },
    "validated": true
}`)))



console.log('-----------------')
console.log('-----------------')
console.log('-----------------')




console.log(deriveExchanges(JSON.parse(`{
    "Account": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
    "Fee": "12",
    "Flags": 2148139008,
    "Sequence": 60852363,
    "SigningPubKey": "02273713CEAC552CD26CE40BCC2DAF411E7692C9A3452397CCE6C69085590A2A24",
    "TakerGets": {
        "currency": "USD",
        "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
        "value": "500"
    },
    "TakerPays": "515738344",
    "TransactionType": "OfferCreate",
    "TxnSignature": "3045022100BEDEC522D29CCAC96E91C636331418666B3D27965B38259968D36CDC07CF628E02201C9CFA606F2B29729483B2D30CDF5B44B4CFA7889A15778997E75C62B51B581C",
    "date": 691232351,
    "hash": "E085F93A789E504A75B3A78D78EC6FFC3114F9AAB57CCF5D8998D63F3F7DE6BC",
    "inLedger": 67947470,
    "ledger_index": 67947470,
    "meta": {
        "AffectedNodes": [
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rnKiczmiQkZFiDES8THYyLA2pQohC5C6EF",
                        "Balance": "5573513291",
                        "EmailHash": "7CA852F394FD698696642B40BF83AFC2",
                        "Flags": 0,
                        "MessageKey": "0200000000000000000000000048D9269F9A408009272AB0F0A7F81271AD55EFC0",
                        "OwnerCount": 10,
                        "Sequence": 61408971
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "35E3EA0727114A679572BDC47A97D0DB62990A992C7078DD363611E4AF3DD55F",
                    "PreviousFields": {
                        "Balance": "6104723786"
                    },
                    "PreviousTxnID": "33D60FCC8B3D5208C3C573EF5E7FF5CE4F08F6ECDC68C118B9FA521041E0BFC7",
                    "PreviousTxnLgrSeq": 67947459
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rnKiczmiQkZFiDES8THYyLA2pQohC5C6EF",
                        "BookDirectory": "DFA3B6DDAB58C7E8E5D944E736DA4B7046C30E4F460FD9DE4E21709633CCA4F7",
                        "BookNode": "0",
                        "Expiration": 691232437,
                        "Flags": 0,
                        "OwnerNode": "0",
                        "Sequence": 61408962,
                        "TakerGets": "765308885",
                        "TakerPays": {
                            "currency": "USD",
                            "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                            "value": "720.344282957572"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "B98622FD28D7DE9127AAA3F87FF76184F6626EBBED3E1674B744DFDCFE1B1527",
                    "PreviousFields": {
                        "TakerGets": "1296519380",
                        "TakerPays": {
                            "currency": "USD",
                            "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                            "value": "1220.344282957572"
                        }
                    },
                    "PreviousTxnID": "79059CCC0B3ADBC5C18E8FE2863D12F884AAAD9D69EEA63D38E53648570146FC",
                    "PreviousTxnLgrSeq": 67947456
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "USD",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-6245.977627944559"
                        },
                        "Flags": 2228224,
                        "HighLimit": {
                            "currency": "USD",
                            "issuer": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
                            "value": "999999999"
                        },
                        "HighNode": "0",
                        "LowLimit": {
                            "currency": "USD",
                            "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                            "value": "0"
                        },
                        "LowNode": "62b"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "D3068FC3E69481D48D0F87FC4FC825D294BD47A7FCB230D968CCFF254ECBF137",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "USD",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-6746.977627944559"
                        }
                    },
                    "PreviousTxnID": "B9A23969B0A4FABBA2BEA7DB7292368ABAAA71EC93E9B14B9F479B679E4D550E",
                    "PreviousTxnLgrSeq": 67401091
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
                        "Balance": "57038336670",
                        "Flags": 0,
                        "OwnerCount": 49,
                        "Sequence": 60852364
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "D762B5BB653CCFCCF592FCA049B2046E4E56A5939AA774EB52ED008ACDCFD0C8",
                    "PreviousFields": {
                        "Balance": "56507126187",
                        "Sequence": 60852363
                    },
                    "PreviousTxnID": "08C2177A950D493581FBB960A696D45046BE114B824C19502BE3E96F9618E000",
                    "PreviousTxnLgrSeq": 67917735
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "USD",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-9719.68109757042"
                        },
                        "Flags": 2228224,
                        "HighLimit": {
                            "currency": "USD",
                            "issuer": "rnKiczmiQkZFiDES8THYyLA2pQohC5C6EF",
                            "value": "100000000"
                        },
                        "HighNode": "0",
                        "LowLimit": {
                            "currency": "USD",
                            "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                            "value": "0"
                        },
                        "LowNode": "64a"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "DE1CDD68499573CA1B4C7BF7BFAFCE9A9C1F5D3FD794BAAFFA2A80A9D3B1D785",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "USD",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-9219.68109757042"
                        }
                    },
                    "PreviousTxnID": "CAE0C0DCEBF36BBDD6642B392E4509E7104A5172D311CE571F69FE1B05B56056",
                    "PreviousTxnLgrSeq": 67942872
                }
            }
        ],
        "TransactionIndex": 24,
        "TransactionResult": "tesSUCCESS"
    },
    "validated": true
}`)))



console.log('-----------------')
console.log('-----------------')
console.log('-----------------')




console.log(deriveExchanges(JSON.parse(`{
    "Account": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
    "Fee": "20",
    "Flags": 2147483648,
    "Sequence": 60852376,
    "SigningPubKey": "02273713CEAC552CD26CE40BCC2DAF411E7692C9A3452397CCE6C69085590A2A24",
    "TakerGets": {
        "currency": "5852646F67650000000000000000000000000000",
        "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
        "value": "2000000"
    },
    "TakerPays": "1200000000",
    "TransactionType": "OfferCreate",
    "TxnSignature": "3045022100A0CA839A33133CDD829B2D49EAFA98BFD1B33E1A9A38B11A291B1208FA05AF76022063B5AD168C5D22625DD655E56C6922D8450F3ED13292445F79965569EEBC3FAF",
    "date": 691696760,
    "hash": "8148DAB0772014A03726817531DEFF0617D5EBA0837195C1B3580700666A6C7F",
    "inLedger": 68062357,
    "ledger_index": 68062357,
    "meta": {
        "AffectedNodes": [
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "33077826.08382402"
                        },
                        "Flags": 1114112,
                        "HighLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "0"
                        },
                        "HighNode": "3bb",
                        "LowLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
                            "value": "99999949999.99921"
                        },
                        "LowNode": "1"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "232D155E4993C186131FBA38D6F083D038E10BE7FD546C3DDBBFE265E6D57659",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "35000000.9623164"
                        }
                    },
                    "PreviousTxnID": "679F7BB938259FABE133BD24B3C667665FEDCDB969891825FC1DB861DE9471FC",
                    "PreviousTxnLgrSeq": 67555604
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Flags": 0,
                        "Owner": "rDogkw75XgwYfAcX4om7jYUgZyXvQrkh6i",
                        "RootIndex": "49D93CABE69D3B998B618E69880A2BCF6B1C436D4C1F685DFB6DCBC525AFC734"
                    },
                    "LedgerEntryType": "DirectoryNode",
                    "LedgerIndex": "49D93CABE69D3B998B618E69880A2BCF6B1C436D4C1F685DFB6DCBC525AFC734"
                }
            },
            {
                "DeletedNode": {
                    "FinalFields": {
                        "Account": "rDogkw75XgwYfAcX4om7jYUgZyXvQrkh6i",
                        "BookDirectory": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205A3A472A6CDC2",
                        "BookNode": "0",
                        "Expiration": 691696933,
                        "Flags": 0,
                        "OwnerNode": "0",
                        "PreviousTxnID": "5ABB65EEB21BD6BCB51107E9EE8634F61748131F39F51D29F515978856536C6C",
                        "PreviousTxnLgrSeq": 68062342,
                        "Sequence": 67453127,
                        "TakerGets": "0",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "0"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "538C87ABC2A2FFFC18EBC975A37A393A7019F008A5DB780AC96422338610D2CA",
                    "PreviousFields": {
                        "TakerGets": "120000000",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "190476.1892461904"
                        }
                    }
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rDogkw75XgwYfAcX4om7jYUgZyXvQrkh6i",
                        "Balance": "362161691",
                        "Flags": 0,
                        "OwnerCount": 5,
                        "Sequence": 67453129
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "85CF66F427A8581423CBADE9DF699E3D09A5AECDE028D8B0E93E194886013E11",
                    "PreviousFields": {
                        "Balance": "602161691",
                        "OwnerCount": 7
                    },
                    "PreviousTxnID": "73065C34DB6BB15636018693FCAFE4A1D8E0BA52F2CA53D413DF4F8968844F8B",
                    "PreviousTxnLgrSeq": 68062350
                }
            },
            {
                "DeletedNode": {
                    "FinalFields": {
                        "Account": "rDogkw75XgwYfAcX4om7jYUgZyXvQrkh6i",
                        "BookDirectory": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205A3A472A6CDC2",
                        "BookNode": "0",
                        "Expiration": 691696963,
                        "Flags": 0,
                        "OwnerNode": "0",
                        "PreviousTxnID": "73065C34DB6BB15636018693FCAFE4A1D8E0BA52F2CA53D413DF4F8968844F8B",
                        "PreviousTxnLgrSeq": 68062350,
                        "Sequence": 67453128,
                        "TakerGets": "0",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "0"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "884DA50EC3560A14676242CC46133A1DD7094990EAFD9FFD7EC90A07BCF855D5",
                    "PreviousFields": {
                        "TakerGets": "120000000",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "190476.1892461904"
                        }
                    }
                }
            },
            {
                "DeletedNode": {
                    "FinalFields": {
                        "Account": "rGRyfRcJ7cSYSu6rw5VpNJReEZt9Gzy9a7",
                        "BookDirectory": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205A3A4734334D3",
                        "BookNode": "0",
                        "Flags": 0,
                        "OwnerNode": "1",
                        "PreviousTxnID": "EE0F6DA1C42B88D201C8566CBC7699E74C0041EC2CDD1976C69B3D50F60E22C6",
                        "PreviousTxnLgrSeq": 68061915,
                        "Sequence": 67157305,
                        "TakerGets": "0",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "0"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "88E5413897083F6937FEB3B6EE1BF6CD623A7FC989E6880257E3B97AFC2E7761",
                    "PreviousFields": {
                        "TakerGets": "157500000",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "250000"
                        }
                    }
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rDVfD1TzbwCNLw7KEVWsRq988CvCJbYbst",
                        "BookDirectory": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205B76081719000",
                        "BookNode": "0",
                        "Flags": 131072,
                        "OwnerNode": "2",
                        "Sequence": 65804725,
                        "TakerGets": "327500000",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "526947.5"
                        }
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "8C95F6BBBE4A65BDD460D1B7911995A67772F4985C41D660FA6AAFB6073617F9",
                    "PreviousFields": {
                        "TakerGets": "1130000000",
                        "TakerPays": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "1818170"
                        }
                    },
                    "PreviousTxnID": "09FE3A711D47F3E525FDDFDDEC1C942E78A27475249ECC9A66E3C49C047AE102",
                    "PreviousTxnLgrSeq": 68062113
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rDVfD1TzbwCNLw7KEVWsRq988CvCJbYbst",
                        "Balance": "1469522297",
                        "Flags": 0,
                        "OwnerCount": 61,
                        "Sequence": 65804726
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "D12E0640C0807DEA71AAA5A55BECC4F461A69D6DD180C9143869E4D1FA1739E3",
                    "PreviousFields": {
                        "Balance": "2272022297"
                    },
                    "PreviousTxnID": "09FE3A711D47F3E525FDDFDDEC1C942E78A27475249ECC9A66E3C49C047AE102",
                    "PreviousTxnLgrSeq": 68062113
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
                        "Balance": "44520282190",
                        "Flags": 0,
                        "OwnerCount": 49,
                        "Sequence": 60852377
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "D762B5BB653CCFCCF592FCA049B2046E4E56A5939AA774EB52ED008ACDCFD0C8",
                    "PreviousFields": {
                        "Balance": "43320282210",
                        "Sequence": 60852376
                    },
                    "PreviousTxnID": "C738139C80A0FCDC798CE98C16F8B27A6FDA82F91692D3403FF48352A1DE9A2A",
                    "PreviousTxnLgrSeq": 68062349
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Flags": 0,
                        "Owner": "rGRyfRcJ7cSYSu6rw5VpNJReEZt9Gzy9a7",
                        "RootIndex": "A84E96499A7672D22BBC809E15BE6C7AF5F5754462DBE246FCA564DE0499D669"
                    },
                    "LedgerEntryType": "DirectoryNode",
                    "LedgerIndex": "D8DCFD199B374C1930D74B52DC45918BC169AC36EEDFA479505CAA1742BE6F2B"
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "4027918.706641987"
                        },
                        "Flags": 1114112,
                        "HighLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "0"
                        },
                        "HighNode": "1c8",
                        "LowLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rGRyfRcJ7cSYSu6rw5VpNJReEZt9Gzy9a7",
                            "value": "1000000000000000e-4"
                        },
                        "LowNode": "0"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "E72E5F6CB555C87C5BC9D4BEB15C52E0BCC85258E36D66066FB79D082A21CA92",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "3777918.706641987"
                        }
                    },
                    "PreviousTxnID": "95A6EEB68981040BA8B3ABE3D6D003A1A8D9E7A035F7DA12E63D4D147F751F2F",
                    "PreviousTxnLgrSeq": 68061337
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "564162.8020569587"
                        },
                        "Flags": 1114112,
                        "HighLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "0"
                        },
                        "HighNode": "489",
                        "LowLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rDogkw75XgwYfAcX4om7jYUgZyXvQrkh6i",
                            "value": "99999925999"
                        },
                        "LowNode": "0"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "EC41135AA610204151EE543D2C5275CACFB8F8E8C9CED99FAEAE8F93B27FB815",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "183210.4235645779"
                        }
                    },
                    "PreviousTxnID": "BBB818403979464ED574466D5B1E93AA9CCBF139E7243FE29991CF45F1C0E991",
                    "PreviousTxnLgrSeq": 68061554
                }
            },
            {
                "DeletedNode": {
                    "FinalFields": {
                        "ExchangeRate": "5205a3a472a6cdc2",
                        "Flags": 0,
                        "RootIndex": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205A3A472A6CDC2",
                        "TakerGetsCurrency": "0000000000000000000000000000000000000000",
                        "TakerGetsIssuer": "0000000000000000000000000000000000000000",
                        "TakerPaysCurrency": "5852646F67650000000000000000000000000000",
                        "TakerPaysIssuer": "D98817F9CF03AE03FC31F43C8DCEEADF277D5EE7"
                    },
                    "LedgerEntryType": "DirectoryNode",
                    "LedgerIndex": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205A3A472A6CDC2"
                }
            },
            {
                "DeletedNode": {
                    "FinalFields": {
                        "ExchangeRate": "5205a3a4734334d3",
                        "Flags": 0,
                        "RootIndex": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205A3A4734334D3",
                        "TakerGetsCurrency": "0000000000000000000000000000000000000000",
                        "TakerGetsIssuer": "0000000000000000000000000000000000000000",
                        "TakerPaysCurrency": "5852646F67650000000000000000000000000000",
                        "TakerPaysIssuer": "D98817F9CF03AE03FC31F43C8DCEEADF277D5EE7"
                    },
                    "LedgerEntryType": "DirectoryNode",
                    "LedgerIndex": "F2D91B1CAE9365A0546D4D7E953BB7B756106CD80933E9795205A3A4734334D3"
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rGRyfRcJ7cSYSu6rw5VpNJReEZt9Gzy9a7",
                        "Balance": "1399075157",
                        "Flags": 0,
                        "OwnerCount": 20,
                        "Sequence": 67157306
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "F4BF9FD325791D50731691ABF04E755C7F3B9565E09F8579B77F280D3788DBEE",
                    "PreviousFields": {
                        "Balance": "1556575157",
                        "OwnerCount": 21
                    },
                    "PreviousTxnID": "EE0F6DA1C42B88D201C8566CBC7699E74C0041EC2CDD1976C69B3D50F60E22C6",
                    "PreviousTxnLgrSeq": 68061915
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "1291222.5"
                        },
                        "Flags": 1114112,
                        "HighLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA",
                            "value": "0"
                        },
                        "HighNode": "21c",
                        "LowLimit": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rDVfD1TzbwCNLw7KEVWsRq988CvCJbYbst",
                            "value": "1000000000000000e-4"
                        },
                        "LowNode": "0"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "FD7D6BC51A4D75B5FD9AEDA9CD1C9EE0DDE820C3983F83B94FE660699735A8F4",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "5852646F67650000000000000000000000000000",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "0"
                        }
                    },
                    "PreviousTxnID": "8697B6E22AB2DFB98293D83DDF11A327D8B9FED5CF0A55CD71B0620BD4DB1866",
                    "PreviousTxnLgrSeq": 68054951
                }
            }
        ],
        "TransactionIndex": 3,
        "TransactionResult": "tesSUCCESS"
    },
    "validated": true
}`)))