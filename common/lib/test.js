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
    "Fee": "12",
    "Flags": 2148270080,
    "Sequence": 60852247,
    "SigningPubKey": "02273713CEAC552CD26CE40BCC2DAF411E7692C9A3452397CCE6C69085590A2A24",
    "TakerGets": "1000000",
    "TakerPays": {
        "currency": "USD",
        "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
        "value": "1.126229"
    },
    "TransactionType": "OfferCreate",
    "TxnSignature": "3045022100C94F508D92CE1B89BA9E901FA39235FE05DDD1474CE0CC9B33FF26764D8A834C022017648D3F0E9A524E07FF27B8CE4407424ABCA7C9C40A802A37E8AF5C6FE7A519",
    "date": 687755521,
    "hash": "EF197E6FB87C54EFB59D574452E073EF496F87042979DD21B54679BC5563C5C4",
    "inLedger": 67077827,
    "ledger_index": 67077827,
    "meta": {
        "AffectedNodes": [
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rwCyujNHfkbN1hi4XSbU9mZKxwn3BSto78",
                        "BookDirectory": "4627DFFCFF8B5A265EDBD8AE8C14A52325DBFEDAF4F5C32E5A1F8B6ECD99E7BE",
                        "BookNode": "0",
                        "Flags": 0,
                        "OwnerNode": "0",
                        "Sequence": 67465097,
                        "TakerGets": {
                            "currency": "USD",
                            "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                            "value": "1585.591887719848"
                        },
                        "TakerPays": "1407852157"
                    },
                    "LedgerEntryType": "Offer",
                    "LedgerIndex": "2BC56AEA48272A9B1967A084FFEF2798A05607D5B8557514E6BB5F0DB9CA516C",
                    "PreviousFields": {
                        "TakerGets": {
                            "currency": "USD",
                            "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                            "value": "1586.718136580451"
                        },
                        "TakerPays": "1408852157"
                    },
                    "PreviousTxnID": "6CA4B6CBC4ACDC16044AF932D52AA43E07B0962B0681B3B581F6DE05428E4823",
                    "PreviousTxnLgrSeq": 67077826
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rwCyujNHfkbN1hi4XSbU9mZKxwn3BSto78",
                        "Balance": "6002860641",
                        "Flags": 0,
                        "OwnerCount": 10,
                        "Sequence": 67465102
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "4A04BEEAA69A3B306D4B4F6A32CE7ACA09212CBB5C6778298373C60F1D4C625A",
                    "PreviousFields": {
                        "Balance": "6001860641"
                    },
                    "PreviousTxnID": "F6186F49E2D0E652D6554D6F1160DD894519220F2E68DCEED5BF60AAC5202784",
                    "PreviousTxnLgrSeq": 67077826
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "USD",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-3947.607303429904"
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
                            "value": "-3946.481054569301"
                        }
                    },
                    "PreviousTxnID": "A69BBB7ECFEE83551DDD08B75967A36DDB16F36CB7C26ADB2111DBF75BB730D2",
                    "PreviousTxnLgrSeq": 67077764
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Account": "rE9Ef6Ldf3TrhtFHwsDrbNB2dzfwoCyMGY",
                        "Balance": "28368889100",
                        "Flags": 0,
                        "OwnerCount": 30,
                        "Sequence": 60852248
                    },
                    "LedgerEntryType": "AccountRoot",
                    "LedgerIndex": "D762B5BB653CCFCCF592FCA049B2046E4E56A5939AA774EB52ED008ACDCFD0C8",
                    "PreviousFields": {
                        "Balance": "28369889112",
                        "Sequence": 60852247
                    },
                    "PreviousTxnID": "A69BBB7ECFEE83551DDD08B75967A36DDB16F36CB7C26ADB2111DBF75BB730D2",
                    "PreviousTxnLgrSeq": 67077764
                }
            },
            {
                "ModifiedNode": {
                    "FinalFields": {
                        "Balance": {
                            "currency": "USD",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-9083.452148380855"
                        },
                        "Flags": 2228224,
                        "HighLimit": {
                            "currency": "USD",
                            "issuer": "rwCyujNHfkbN1hi4XSbU9mZKxwn3BSto78",
                            "value": "1000000000"
                        },
                        "HighNode": "0",
                        "LowLimit": {
                            "currency": "USD",
                            "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                            "value": "0"
                        },
                        "LowNode": "601"
                    },
                    "LedgerEntryType": "RippleState",
                    "LedgerIndex": "E07169F8BA4AD01995CB441DA792E3DF5589FBA95FEE960F14947F1075A56C47",
                    "PreviousFields": {
                        "Balance": {
                            "currency": "USD",
                            "issuer": "rrrrrrrrrrrrrrrrrrrrBZbvji",
                            "value": "-9084.58064973918"
                        }
                    },
                    "PreviousTxnID": "A69BBB7ECFEE83551DDD08B75967A36DDB16F36CB7C26ADB2111DBF75BB730D2",
                    "PreviousTxnLgrSeq": 67077764
                }
            }
        ],
        "TransactionIndex": 52,
        "TransactionResult": "tesSUCCESS"
    },
    "validated": true
}`)))