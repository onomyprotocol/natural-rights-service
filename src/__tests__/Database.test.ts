import {
  NaturalRightsServiceDatabase,
  Souls
} from '../NaturalRightsServiceDatabase'

describe('Database', () => {
  let db: NaturalRightsServiceDatabase
  let dbAdapter: NaturalRightsDatabaseAdapter

  beforeEach(() => {
    dbAdapter = {
      close: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      getDocumentGrants: jest.fn().mockResolvedValue([]),
      put: jest.fn().mockResolvedValue(undefined)
    }
    db = new NaturalRightsServiceDatabase(dbAdapter)
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
  })

  describe('Account', () => {
    describe('getAccount', () => {
      it('Resolves a account record when present', async () => {
        const accountId = 'testaccountid'
        const expectedSoul = Souls.account(accountId)
        const accountRecord: AccountRecord = {
          cryptPubKey: '',
          encCryptPrivKey: '',
          encSignPrivKey: '',
          id: accountId,
          rootDocumentId: '',
          signPubKey: ''
        }
        dbAdapter.get = jest.fn().mockResolvedValue(accountRecord)

        const result = await db.getAccount(accountId)
        expect(dbAdapter.get).toBeCalledWith(expectedSoul)
        expect(result).toEqual(accountRecord)
      })

      it('Resolves null when no account is present', async () => {
        const accountId = 'testaccountid'
        const expectedSoul = Souls.account(accountId)

        const result = await db.getAccount(accountId)
        expect(dbAdapter.get).toBeCalledWith(expectedSoul)
        expect(result).toEqual(null)
      })
    })

    describe('putAccount', () => {
      it('persists a account record via the adapter', async () => {
        const accountId = 'testaccountid'
        const expectedSoul = Souls.account(accountId)
        const accountRecord: AccountRecord = {
          cryptPubKey: '',
          encCryptPrivKey: '',
          encSignPrivKey: '',
          id: accountId,
          rootDocumentId: '',
          signPubKey: ''
        }

        await db.putAccount(accountRecord)
        expect(dbAdapter.put).toBeCalledWith(expectedSoul, accountRecord)
      })
    })

    describe('deleteAccount', () => {
      it('deletes account for given id', async () => {
        const accountId = 'testaccountid'
        const expectedSoul = Souls.account(accountId)

        await db.deleteAccount(accountId)
        expect(dbAdapter.delete).toBeCalledWith(expectedSoul)
      })
    })
  })

  describe('Client', () => {
    describe('getClient', () => {
      it('resolves a client record when present', async () => {
        const accountId = 'testaccountid'
        const clientId = 'testclientid'
        const expectedSoul = Souls.client(clientId)
        const clientRecord: ClientRecord = {
          accountId,
          cryptPubKey: '',
          cryptTransformKey: '',
          id: clientId,
          signPubKey: ''
        }
        dbAdapter.get = jest.fn().mockResolvedValue(clientRecord)

        const result = await db.getClient(clientId)
        expect(dbAdapter.get).toBeCalledWith(expectedSoul)
        expect(result).toEqual(clientRecord)
      })
    })

    describe('putClient', () => {
      it('persists a client record via the adapter', async () => {
        const accountId = 'testaccountid'
        const clientId = 'testclientid'
        const expectedSoul = Souls.client(clientId)
        const clientRecord: ClientRecord = {
          accountId,
          cryptPubKey: '',
          cryptTransformKey: '',
          id: clientId,
          signPubKey: ''
        }

        await db.putClient(clientRecord)
        expect(dbAdapter.put).toBeCalledWith(expectedSoul, clientRecord)
      })
    })

    describe('deleteClient', () => {
      it('deletes a client record and associated transformKey', async () => {
        const clientId = 'testclientid'
        const expectedSoul = Souls.client(clientId)

        await db.deleteClient(clientId)
        expect(dbAdapter.delete).toBeCalledWith(expectedSoul)
      })
    })
  })

  describe('Group', () => {
    describe('getGroup', () => {
      it('resolves group record when present', async () => {
        const groupId = 'testgroupid'
        const expectedSoul = Souls.group(groupId)
        const groupRecord: GroupRecord = {
          accountId: 'testAccountId',
          cryptPubKey: '',
          encCryptPrivKey: '',
          encSignPrivKey: '',
          id: groupId
        }

        expect(await db.getGroup(groupId)).toEqual(null)
        dbAdapter.get = jest.fn().mockResolvedValue(groupRecord)

        const result = await db.getGroup(groupId)
        expect(dbAdapter.get).toBeCalledWith(expectedSoul)
        expect(result).toEqual(groupRecord)
      })
    })

    describe('putGroup', () => {
      it('persists a group record via the adapter', async () => {
        const groupId = 'testgroupid'
        const expectedSoul = Souls.group(groupId)
        const groupRecord: GroupRecord = {
          accountId: 'testAccountId',
          cryptPubKey: '',
          encCryptPrivKey: '',
          encSignPrivKey: '',
          id: groupId
        }

        await db.putGroup(groupRecord)
        expect(dbAdapter.put).toBeCalledWith(expectedSoul, groupRecord)
      })
    })

    describe('deleteGroup', () => {
      it('deletes a group record', async () => {
        const groupId = 'testgroupid'
        const expectedSoul = Souls.group(groupId)
        await db.deleteGroup(groupId)
        expect(dbAdapter.delete).toBeCalledWith(expectedSoul)
      })

      it.todo('deletes associated grants')
    })
  })

  describe('Membership', () => {
    const accountId = 'testaccountid'
    const groupId = 'testgroupid'
    const expectedSoul = Souls.membership(groupId, accountId)
    const membershipRecord: MembershipRecord = {
      accountId,
      canSign: false,
      cryptTransformKey: '',
      encGroupCryptPrivKey: '',
      groupId
    }

    describe('getMembership', () => {
      it('resolves membership record for group/account if present', async () => {
        dbAdapter.get = jest.fn().mockResolvedValue(membershipRecord)
        const result = await db.getMembership(groupId, accountId)
        expect(dbAdapter.get).toBeCalledWith(expectedSoul)
        expect(result).toEqual(membershipRecord)
      })
    })

    describe('putMembership', () => {
      it('persists a membership record via the adapter', async () => {
        await db.putMembership(membershipRecord)
        expect(dbAdapter.put).toBeCalledWith(expectedSoul, membershipRecord)
      })
    })

    describe('deleteMembership', () => {
      it('deletes a membership record and associated transformKey', async () => {
        await db.deleteMembership(groupId, accountId)
        expect(dbAdapter.delete).toBeCalledWith(expectedSoul)
      })
    })
  })

  describe('Document', () => {
    const documentId = 'testdocumentid'
    const expectedSoul = Souls.document(documentId)
    const documentRecord: DocumentRecord = {
      creatorId: '',
      cryptAccountId: '',
      cryptPubKey: '',
      encCryptPrivKey: '',
      id: documentId,
      signPrivKey: ''
    }

    describe('getDocument', () => {
      it('resolves document record for given id when present', async () => {
        dbAdapter.get = jest.fn().mockResolvedValue(documentRecord)
        const result = await db.getDocument(documentId)
        expect(dbAdapter.get).toBeCalledWith(expectedSoul)
        expect(result).toEqual(documentRecord)
      })
    })

    describe('putDocument', () => {
      it('persists a document record via the adapter', async () => {
        await db.putDocument(documentRecord)
        expect(dbAdapter.put).toBeCalledWith(expectedSoul, documentRecord)
      })
    })

    describe('deleteDocument', () => {
      it('deletes a document record', async () => {
        await db.deleteDocument(documentId)
        expect(dbAdapter.delete).toBeCalledWith(expectedSoul)
      })
    })
  })

  describe('Grant', () => {
    const documentId = 'testdocumentid'
    const accountId = 'testaccountid'
    const expectedSoul = Souls.grant(documentId, 'account', accountId)
    const grantRecord: GrantRecord = {
      canSign: false,
      documentId,
      encCryptPrivKey: '',
      id: accountId,
      kind: 'account'
    }

    describe('getGrant', () => {
      it('resolves grant record when present', async () => {
        expect(await db.getGrant(documentId, 'account', accountId)).toEqual(
          null
        )
        dbAdapter.get = jest.fn().mockResolvedValue(grantRecord)

        const result = await db.getGrant(documentId, 'account', accountId)
        expect(dbAdapter.get).toBeCalledWith(expectedSoul)
        expect(result).toEqual(grantRecord)
      })
    })

    describe('putGrant', () => {
      it('persists a grant record', async () => {
        dbAdapter.get = jest.fn().mockResolvedValue(grantRecord)

        await db.putGrant(grantRecord)
        expect(dbAdapter.put).toBeCalledWith(expectedSoul, grantRecord)
      })
    })

    describe('deleteGrant', () => {
      it('deletes a grant record', async () => {
        await db.deleteGrant(documentId, 'account', accountId)
        expect(dbAdapter.delete).toBeCalledWith(expectedSoul)
      })
    })

    describe('getDocumentGrants', () => {
      it('resolves document grant records from db', async () => {
        const grants: readonly GrantRecord[] = [
          {
            canSign: false,
            documentId,
            encCryptPrivKey: '',
            id: 'testAccountId',
            kind: 'account'
          },
          {
            canSign: false,
            documentId,
            encCryptPrivKey: '',
            id: 'testGroupId',
            kind: 'group'
          }
        ]
        dbAdapter.getDocumentGrants = jest.fn().mockResolvedValue(grants)

        expect(await db.getDocumentGrants(documentId)).toEqual(grants)
        expect(dbAdapter.getDocumentGrants).toBeCalledWith(
          Souls.document(documentId)
        )
      })
    })
  })
})
