import {
  NRGrantAccessActionPayload,
  NRRevokeAccessActionPayload,
  PREPrimitivesInterface
} from '@natural-rights/common'
import * as SEA from '@notabug/gun-sear'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import {
  AddAdminToGroup,
  AddMemberToGroup,
  AuthorizeClient,
  CreateDocument,
  CreateGroup,
  DeauthorizeClient,
  DecryptDocument,
  GetKeyPairs,
  GetPubKeys,
  GrantAccess,
  InitializeAccount,
  RemoveAdminFromGroup,
  RemoveMemberFromGroup,
  RevokeAccess,
  UpdateDocument
} from '../NRActions'
import { ActionHandler } from '../NRActions/ActionHandler'

describe('NRActions', () => {
  let primitives: PREPrimitivesInterface
  let dbAdapter: NaturalRightsDatabaseAdapter
  let db: NaturalRightsDatabaseInterface
  let service: NaturalRightsLocalService

  beforeEach(() => {
    primitives = {
      cryptKeyGen: jest.fn().mockResolvedValue({
        privKey: 'cryptPrivKey',
        pubKey: 'cryptPubKey'
      }),
      cryptTransform: jest
        .fn()
        .mockImplementation(
          async (transformKey, ciphertext) =>
            `transformed:${transformKey}:${ciphertext}`
        ),
      cryptTransformKeyGen: jest
        .fn()
        .mockImplementation(
          async (keyPair, pubKey) => `transform:${keyPair.privKey}:${pubKey}`
        ),
      decrypt: jest.fn(),
      encrypt: jest
        .fn()
        .mockImplementation(
          async (pubKey, plaintext) => `encrypted:${pubKey}:${plaintext}`
        ),
      sign: jest.fn(),
      signKeyGen: jest.fn().mockResolvedValue({
        privKey: 'signPrivKey',
        pubKey: 'signPubKey'
      }),
      verify: jest.fn()
    }
    dbAdapter = {
      close: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      getDocumentGrants: jest.fn().mockResolvedValue([]),
      put: jest.fn().mockResolvedValue(undefined)
    }

    service = new NaturalRightsLocalService(primitives, dbAdapter)
    db = service.db
  })

  describe('ActionHandler', () => {
    describe('default implementation', () => {
      class MyActionHandler extends ActionHandler {}

      it('allows nobody', async () => {
        const handler = new MyActionHandler('accountId', 'clientId')

        expect(await handler.checkIsAuthorized(service)).toEqual(false)
      })

      it('does nothing', async () => {
        const handler = new MyActionHandler('accountId', 'clientId')

        expect(await handler.execute(service)).toEqual(null)
      })
    })
  })

  describe('InitializeAccount', () => {
    it('requires that the requesting account match the accountId of the request and that the account not exist', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'

      const actionBase = {
        cryptPubKey: 'cryptPubKey',
        encCryptPrivKey: 'encCryptPrivKey',
        encSignPrivKey: 'encSignPrivKey',
        rootDocCryptPubKey: `rootDocCryptPubKey`,
        rootDocEncCryptPrivKey: `rootDocEncCryptPrivKey`,
        signPubKey: 'signPubKey'
      }

      const withMatch = new InitializeAccount(accountId, clientId, {
        ...actionBase,
        accountId
      })

      const withoutMatch = new InitializeAccount(accountId, clientId, {
        ...actionBase,
        accountId: 'otherAccountId'
      })

      db.getAccount = jest.fn().mockResolvedValue(null)
      db.getClient = jest.fn().mockResolvedValue({
        accountId: ''
      })

      expect(await withoutMatch.checkIsAuthorized(service)).toEqual(false)
      expect(db.getAccount).not.toBeCalled()

      await withMatch.checkIsAuthorized(service)
      expect(db.getClient).toBeCalledWith(clientId)
      expect(db.getAccount).toBeCalledWith(accountId)

      expect(await withMatch.checkIsAuthorized(service)).toEqual(true)
      db.getAccount = jest.fn().mockResolvedValue({
        accountId
      })
      expect(await withMatch.checkIsAuthorized(service)).toEqual(false)
      expect(db.getAccount).toBeCalledWith(accountId)

      db.getAccount = jest.fn().mockResolvedValue(null)
      db.getClient = jest.fn().mockResolvedValue({
        accountId
      })

      expect(await withMatch.checkIsAuthorized(service)).toEqual(false)
    })

    it('persists AccountRecord', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocId'
      const docSignPrivKey = 'testDocPrivKey'
      const shared = {
        cryptPubKey: 'cryptPubKey',
        encCryptPrivKey: 'encCryptPrivKey',
        encSignPrivKey: 'encSignPrivKey',
        signPubKey: 'signPubKey'
      }
      const payload = {
        ...shared,
        accountId,
        rootDocCryptPubKey: `rootDocCryptPubKey`,
        rootDocEncCryptPrivKey: `rootDocEncCryptPrivKey`
      }
      const record = { ...shared, id: accountId, rootDocumentId: documentId }
      db.putAccount = jest.fn().mockResolvedValue(undefined)

      const pairMock = jest.spyOn(SEA, 'pair').mockResolvedValue({
        epriv: '',
        epub: '',
        priv: docSignPrivKey,
        pub: documentId
      })

      try {
        const handler = new InitializeAccount(accountId, clientId, payload)

        expect(await handler.execute(service)).toEqual(payload)
        expect(db.putAccount).toBeCalledWith(record)
      } finally {
        pairMock.mockRestore()
      }
    })
  })

  describe('AuthorizeClient', () => {
    it('requires that the requesting account match the accountId of the request', async () => {
      const shared = {
        clientId: 'testClientId',
        cryptPubKey: 'clientCryptPubKey',
        cryptTransformKey: 'clientCryptTransformKey',
        signPubKey: 'clientSignPubKey'
      }

      const withMatch = new AuthorizeClient('accountId', 'clientId', {
        ...shared,
        accountId: 'accountId'
      })

      const withoutMatch = new AuthorizeClient('accountId', 'clientId', {
        ...shared,
        accountId: 'otherAccountId'
      })

      jest.spyOn(db, 'getClient').mockResolvedValue({} as any)

      expect(await withMatch.checkIsAuthorized(service)).toEqual(true)
      expect(await withoutMatch.checkIsAuthorized(service)).toEqual(false)
    })

    it('persists ClientRecord', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const cryptTransformKey = 'clientCryptTransformKey'
      const cryptPubKey = 'clientCryptPubKey'
      const signPubKey = 'clientSignPubKey'
      const existingData = {
        accountId: '',
        cryptPubKey,
        cryptTransformKey: '',
        id: clientId,
        signPubKey
      }

      db.putClient = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(db, 'getClient').mockResolvedValue(existingData)

      const payload = {
        accountId,
        clientId,
        cryptTransformKey
      }

      const handler = new AuthorizeClient(accountId, clientId, payload)

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.putClient).toBeCalledWith({
        ...existingData,
        accountId,
        cryptTransformKey
      })
    })
  })

  describe('RemoveClient', () => {
    it('requires that the requesting account match the accountId of the request', async () => {
      const withMatch: ActionHandler = new DeauthorizeClient(
        'accountId',
        'clientId',
        {
          accountId: 'accountId',
          clientId: 'clientId'
        }
      )

      const withoutMatch: ActionHandler = new DeauthorizeClient(
        'accountId',
        'clientId',
        {
          accountId: 'otherAccountId',
          clientId: 'clientId'
        }
      )

      expect(await withMatch.checkIsAuthorized(service)).toEqual(true)
      expect(await withoutMatch.checkIsAuthorized(service)).toEqual(false)
    })

    it('deletes client record from database', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const handler = new DeauthorizeClient(accountId, clientId, {
        accountId,
        clientId
      })
      db.deleteClient = jest.fn().mockResolvedValue(undefined)

      await handler.execute(service)

      expect(db.deleteClient).toBeCalledWith(clientId)
    })
  })

  describe('CreateGroup', () => {
    const accountId = 'testAccountId'
    const clientId = 'testClientId'
    const groupId = 'testGroupId'
    const shared = {
      accountId: 'testAccountId',
      cryptPubKey: 'groupCryptPubKey',
      encCryptPrivKey: 'encGroupCryptPrivKey',
      encSignPrivKey: 'encGroupSignPrivKey'
    }
    const payload = { ...shared, groupId }
    const record = { ...shared, id: groupId }

    it('requires that the requesting account match the accountId of the request', async () => {
      const withMatch: ActionHandler = new CreateGroup(
        'testAccountId',
        'clientId',
        payload
      )
      const withoutMatch: ActionHandler = new CreateGroup(
        'otherAccountId',
        'clientId',
        payload
      )

      expect(await withMatch.checkIsAuthorized(service)).toEqual(true)
      expect(await withoutMatch.checkIsAuthorized(service)).toEqual(false)
    })

    it('persists GroupRecord', async () => {
      const handler = new CreateGroup(accountId, clientId, payload)
      db.putGroup = jest.fn().mockResolvedValue(undefined)

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.putGroup).toBeCalledWith(record)
    })
  })

  describe('AddMemberToGroup', () => {
    const requestingAccountId = 'testAccountId'
    const clientId = 'testClientId'
    const groupId = 'testGroupId'
    const payload = {
      accountId: 'otherAccountId',
      canSign: false,
      cryptTransformKey: 'groupCryptTransformKey',
      groupId
    }
    const record = { ...payload, encGroupCryptPrivKey: '' }

    it('requires that the requesting account be an admin of the group', async () => {
      const handler = new AddMemberToGroup(
        requestingAccountId,
        clientId,
        payload
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )
    })

    it('persists MembershipRecord', async () => {
      const handler = new AddMemberToGroup(
        requestingAccountId,
        clientId,
        payload
      )
      db.putMembership = jest.fn().mockResolvedValue(undefined)

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.putMembership).toBeCalledWith(record)
    })
  })

  describe('RemoveMemberFromGroup', () => {
    const requestingAccountId = 'testAccountId'
    const clientId = 'testClientId'
    const groupId = 'testGroupId'
    const payload = {
      accountId: 'otherAccountId',
      groupId
    }

    it('requires that the requesting account be an admin of the group or the account to remove', async () => {
      const handler = new RemoveMemberFromGroup(
        requestingAccountId,
        clientId,
        payload
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(false)
      const accountMatchHandler = new RemoveMemberFromGroup(
        payload.accountId,
        clientId,
        payload
      )
      expect(await accountMatchHandler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getIsGroupAdmin).not.toBeCalled()

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )
    })

    it('deletes MembershipRecord from database', async () => {
      const handler = new RemoveMemberFromGroup(
        requestingAccountId,
        clientId,
        payload
      )
      db.deleteMembership = jest.fn().mockResolvedValue(undefined)

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.deleteMembership).toBeCalledWith(groupId, payload.accountId)
    })
  })

  describe('AddAdminToGroup', () => {
    it('requires that the requesting account be an admin of the group', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const groupId = 'testGroupId'
      const payload = {
        accountId: 'otherAccountId',
        encCryptPrivKey: 'groupEncCryptPrivKey',
        groupId
      }

      const handler = new AddAdminToGroup(
        requestingAccountId,
        clientId,
        payload
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )
    })

    it('persists MembershipRecord with encrypted private key', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const groupId = 'testGroupId'
      const payload = {
        accountId: 'otherAccountId',
        encCryptPrivKey: 'groupEncCryptPrivKey',
        groupId
      }
      const existingMembership = {
        accountId: 'otherAccountId',
        cryptTransformKey: 'groupCryptTransformKey',
        encGroupCryptPrivKey: '',
        groupId
      }
      db.getMembership = jest.fn().mockResolvedValue(existingMembership)
      db.putMembership = jest.fn().mockResolvedValue(undefined)

      const handler = new AddAdminToGroup(
        requestingAccountId,
        clientId,
        payload
      )

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.getMembership).toBeCalledWith(groupId, payload.accountId)
      expect(db.putMembership).toBeCalledWith({
        ...existingMembership,
        encGroupCryptPrivKey: payload.encCryptPrivKey
      })
    })

    it('throws an error if membership does not exist', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const groupId = 'testGroupId'
      const payload = {
        accountId: 'otherAccountId',
        encCryptPrivKey: 'groupEncCryptPrivKey',
        groupId
      }
      db.getMembership = jest.fn().mockResolvedValue(null)
      db.putMembership = jest.fn().mockResolvedValue(undefined)

      let success = false
      const handler = new AddAdminToGroup(
        requestingAccountId,
        clientId,
        payload
      )

      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('No membership for account'))
      }

      expect(success).toEqual(false)
      expect(db.getMembership).toBeCalledWith(groupId, payload.accountId)
      expect(db.putMembership).not.toBeCalled()
    })
  })

  describe('RemoveAdminFromGroup', () => {
    it('requires that the requesting account be an admin of the group', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const groupId = 'testGroupId'
      const payload = {
        accountId: 'otherAccountId',
        groupId
      }

      const handler = new RemoveAdminFromGroup(
        requestingAccountId,
        clientId,
        payload
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getIsGroupAdmin).toBeCalledWith(
        groupId,
        requestingAccountId
      )
    })

    it('deletes encrypted private key for membership', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const groupId = 'testGroupId'
      const payload = {
        accountId: 'otherAccountId',
        groupId
      }
      const existingMembership = {
        accountId: 'otherAccountId',
        cryptTransformKey: 'groupCryptTransformKey',
        encGroupCryptPrivKey: 'encGroupCryptPrivKey',
        groupId
      }
      db.getMembership = jest.fn().mockResolvedValue(existingMembership)
      db.putMembership = jest.fn().mockResolvedValue(undefined)

      const handler = new RemoveAdminFromGroup(
        requestingAccountId,
        clientId,
        payload
      )

      expect(await handler.execute(service)).toEqual(payload)

      expect(db.getMembership).toBeCalledWith(groupId, payload.accountId)
      expect(db.putMembership).toBeCalledWith({
        ...existingMembership,
        encGroupCryptPrivKey: ''
      })
    })

    it('does nothing if membership does not already exist', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const groupId = 'testGroupId'
      const payload = {
        accountId: 'otherAccountId',
        groupId
      }

      db.getMembership = jest.fn().mockResolvedValue(null)
      db.putMembership = jest.fn().mockResolvedValue(undefined)

      const handler = new RemoveAdminFromGroup(
        requestingAccountId,
        clientId,
        payload
      )

      expect(await handler.execute(service)).toEqual(payload)

      expect(db.getMembership).toBeCalledWith(groupId, payload.accountId)
      expect(db.putMembership).not.toBeCalled()
    })
  })

  describe('CreateDocument', () => {
    const documentId = 'testDocumentId'
    const docSignPrivKey = 'docSignPrivKey'
    const requestingAccountId = 'testAccountId'
    const shared = {
      creatorId: requestingAccountId,
      cryptAccountId: requestingAccountId,
      cryptPubKey: 'documentCryptPubKey',
      encCryptPrivKey: 'documentEncCryptPrivKey'
    }
    const payload = {
      ...shared,
      documentId
    }
    const record = { ...shared, id: documentId, signPrivKey: docSignPrivKey }

    let pairMock: jest.SpyInstance

    beforeEach(() => {
      pairMock = jest.spyOn(SEA, 'pair').mockResolvedValue({
        epriv: '',
        epub: '',
        priv: docSignPrivKey,
        pub: documentId
      })
    })

    afterEach(() => {
      pairMock.mockRestore()
    })

    it('requires that the requesting account match the accountId of the request', async () => {
      const withMatch: ActionHandler = new CreateDocument(
        requestingAccountId,
        'clientId',
        payload
      )
      const withoutMatch: ActionHandler = new CreateDocument(
        'otherAccountId',
        'clientId',
        payload
      )

      expect(await withMatch.checkIsAuthorized(service)).toEqual(true)
      expect(await withoutMatch.checkIsAuthorized(service)).toEqual(false)
    })

    it('persists DocumentRecord', async () => {
      const handler = new CreateDocument(
        requestingAccountId,
        'clientId',
        payload
      )
      db.putDocument = jest.fn().mockResolvedValue(undefined)

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.putDocument).toBeCalledWith(record)
    })
  })

  describe('GrantAccess', () => {
    const requestingAccountId = 'testAccountId'
    const clientId = 'testClientId'
    const documentId = 'testDocumentId'
    const payload: NRGrantAccessActionPayload = {
      canSign: false,
      documentId,
      encCryptPrivKey: 'grantEncCryptPrivKey',
      id: 'otherAccountId',
      kind: 'account'
    }

    it('requires that the requesitng account have access to the document', async () => {
      const handler = new GrantAccess(requestingAccountId, clientId, payload)

      service.getHasReadAccess = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )

      service.getHasReadAccess = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )
    })

    it('persists documentId, accountIdOrGroupId, encryptedDecryptionKey', async () => {
      const handler = new GrantAccess(requestingAccountId, clientId, payload)
      db.putGrant = jest.fn().mockResolvedValue(undefined)
      expect(await handler.execute(service)).toEqual(payload)
      expect(db.putGrant).toBeCalledWith(payload)
    })
  })

  describe('DecryptDocument', () => {
    it('requires that the requesitng account have access to the document', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      const payload = {
        documentId
      }

      const handler = new DecryptDocument(
        requestingAccountId,
        clientId,
        payload
      )

      service.getHasReadAccess = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )

      service.getHasReadAccess = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )
    })

    it('resolves client encrypted document key', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      const payload = {
        documentId
      }
      const encCryptPrivKey = 'clientEncryptedDocumentKey'
      service.getClientDocumentDecryptKey = jest
        .fn()
        .mockResolvedValue(encCryptPrivKey)

      const handler = new DecryptDocument(
        requestingAccountId,
        clientId,
        payload
      )

      expect(await handler.execute(service)).toEqual({
        documentId,
        encCryptPrivKey
      })
    })

    it('fails if the account does not have access', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      const payload = {
        documentId
      }
      service.getClientDocumentDecryptKey = jest.fn().mockResolvedValue(null)

      const handler = new DecryptDocument(
        requestingAccountId,
        clientId,
        payload
      )
      let success = false

      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('No access'))
      }

      expect(success).toEqual(false)
    })
  })

  describe('RevokeAccess', () => {
    it('requires that the requesitng account have access to the document', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      const payload: NRRevokeAccessActionPayload = {
        documentId,
        id: 'otherAccountId',
        kind: 'account'
      }

      const handler = new RevokeAccess(requestingAccountId, clientId, payload)

      service.getHasReadAccess = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )

      service.getHasReadAccess = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )
    })

    it('deletes grant record', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      const payload: NRRevokeAccessActionPayload = {
        documentId,
        id: 'otherAccountId',
        kind: 'account'
      }
      service.getHasReadAccess = jest.fn().mockResolvedValue(true)
      db.deleteGrant = jest.fn().mockResolvedValue(undefined)

      const handler = new RevokeAccess(requestingAccountId, clientId, payload)

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.deleteGrant).toBeCalledWith(
        payload.documentId,
        payload.kind,
        payload.id
      )
    })
  })

  describe('SignDocument', () => {
    describe('authorization', () => {
      it.todo(
        'requires that the requesting account be granted write access to the document'
      )
    })

    describe('execution', () => {
      it.todo('transforms provided client signature to account signature')
      it.todo('transforms account signature to group signature if necessary')
      it.todo('transforms account or group signature to document signature')
      it.todo('returns document signature in response')
    })
  })

  describe('UpdateDocument', () => {
    it('requires that the requesitng account have access to the document', async () => {
      const requestingAccountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      const payload = {
        cryptAccountId: 'testAccountId',
        cryptPubKey: 'documentCryptPubKey',
        documentId: 'testDocumentId',
        encCryptPrivKey: 'documentEncCryptPrivKey'
      }

      const handler = new UpdateDocument(requestingAccountId, clientId, payload)

      service.getHasReadAccess = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )

      service.getHasReadAccess = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getHasReadAccess).toBeCalledWith(
        requestingAccountId,
        documentId
      )
    })

    it('persists updated DocumentRecord', async () => {
      const documentId = 'testDocumentId'
      const shared = {
        cryptAccountId: 'testAccountId',
        cryptPubKey: 'documentCryptPubKey',
        encCryptPrivKey: 'documentEncCryptPrivKey'
      }
      const payload = {
        ...shared,
        documentId
      }
      const record = { ...shared, id: documentId }
      db.putDocument = jest.fn().mockResolvedValue(undefined)
      service.getHasReadAccess = jest.fn().mockResolvedValue(true)

      const handler = new UpdateDocument(
        payload.cryptAccountId,
        'clientId',
        payload
      )

      expect(await handler.execute(service)).toEqual(payload)
      expect(db.putDocument).toBeCalledWith(record)
    })
  })

  describe('GetPubKeys', () => {
    it('allows anyone', async () => {
      const handler: ActionHandler = new GetPubKeys(
        'anyAccountId',
        'anyClientId',
        {
          id: 'whatever',
          kind: 'account'
        }
      )
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
    })

    it('resolves public keys for account', async () => {
      const accountId = 'testAccountId'
      const cryptPubKey = 'accountCryptPubKey'

      db.getAccount = jest.fn().mockResolvedValue({
        cryptPubKey,
        encCryptPrivKey: 'shouldntmatter',
        encSignPrivKey: 'shouldntmatter'
      })
      const handler = new GetPubKeys('anyAccountId', 'anyClientId', {
        id: accountId,
        kind: 'account'
      })

      expect(await handler.execute(service)).toEqual({
        cryptPubKey,
        id: accountId,
        kind: 'account'
      })

      expect(db.getAccount).toBeCalledWith(accountId)
    })

    it('resolves public key(s) for group', async () => {
      const groupId = 'testGroupId'
      const cryptPubKey = 'accountCryptPubKey'

      db.getGroup = jest.fn().mockResolvedValue({
        cryptPubKey,
        encCryptPrivKey: 'shouldntmatter'
      })
      const handler = new GetPubKeys('anyAccountId', 'anyClientId', {
        id: groupId,
        kind: 'group'
      })

      expect(await handler.execute(service)).toEqual({
        cryptPubKey,
        id: groupId,
        kind: 'group',
        signPubKey: ''
      })

      expect(db.getGroup).toBeCalledWith(groupId)
    })

    it('throws error for unknown type', async () => {
      const payload: any = {
        id: 'whatever',
        kind: 'invalid' as unknown
      }
      const handler = new GetPubKeys('anyAccountId', 'anyClientId', payload)

      let success = false

      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Unexpected GetPubKeys kind'))
      }

      expect(success).toEqual(false)
    })

    it('throws error if account does not exist', async () => {
      const accountId = 'testAccountId'
      db.getAccount = jest.fn().mockResolvedValue(null)
      const handler = new GetPubKeys('anyAccountId', 'anyClientId', {
        id: accountId,
        kind: 'account'
      })

      let success = false
      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Account does not exist'))
      }

      expect(success).toEqual(false)
      expect(db.getAccount).toBeCalledWith(accountId)
    })

    it('throws error if group does not exist', async () => {
      const groupId = 'testGroupId'
      db.getGroup = jest.fn().mockResolvedValue(null)
      const handler = new GetPubKeys('anyAccountId', 'anyClientId', {
        id: groupId,
        kind: 'group'
      })

      let success = false
      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Group does not exist'))
      }

      expect(success).toEqual(false)
      expect(db.getGroup).toBeCalledWith(groupId)
    })
  })

  describe('GetKeyPairs', () => {
    it('allows account if requesting account pairs', async () => {
      const accountId = 'testAccountId'
      const handler = new GetKeyPairs(accountId, 'anyClientId', {
        id: accountId,
        kind: 'account'
      })
      const notMyHandler = new GetKeyPairs('otherAccountId', 'anyClientId', {
        id: accountId,
        kind: 'account'
      })

      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(await notMyHandler.checkIsAuthorized(service)).toEqual(false)
    })

    it('allows group admins if requesting group pairs', async () => {
      const accountId = 'testAccountId'
      const groupId = 'testGroupId'
      const handler = new GetKeyPairs(accountId, 'anyClientId', {
        id: groupId,
        kind: 'group'
      })

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(true)
      expect(await handler.checkIsAuthorized(service)).toEqual(true)
      expect(service.getIsGroupAdmin).toBeCalledWith(groupId, accountId)

      service.getIsGroupAdmin = jest.fn().mockResolvedValue(false)
      expect(await handler.checkIsAuthorized(service)).toEqual(false)
      expect(service.getIsGroupAdmin).toBeCalledWith(groupId, accountId)
    })

    it('does not permit unknown type', async () => {
      const payload: any = {
        id: 'whatever',
        kind: 'invalid'
      }
      const handler = new GetKeyPairs('anyAccountId', 'anyClientId', payload)

      expect(await handler.checkIsAuthorized(service)).toEqual(false)
    })

    it('resolves public key(s) and client encrypted private keys for account', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const clientCryptTransformKey = 'clientCryptTransformKey'
      const cryptPubKey = 'accountCryptPubKey'
      const signPubKey = 'accountSignPubKey'
      const accountEncCryptPrivKey = 'accountEncCryptPrivKey'
      const accountEncSignPrivKey = 'accountEncSignPrivKey'
      const account = {
        cryptPubKey,
        encCryptPrivKey: accountEncCryptPrivKey,
        encSignPrivKey: accountEncSignPrivKey,
        id: accountId,
        signPubKey
      }

      const client = {
        accountId,
        clientId,
        cryptTransformKey: clientCryptTransformKey
      }

      db.getAccount = jest.fn().mockResolvedValue(account)
      db.getClient = jest.fn().mockResolvedValue(client)

      const handler = new GetKeyPairs(accountId, clientId, {
        id: accountId,
        kind: 'account'
      })

      expect(await handler.execute(service)).toEqual({
        cryptPubKey,
        encCryptPrivKey: `transformed:${clientCryptTransformKey}:${accountEncCryptPrivKey}`,
        encSignPrivKey: `transformed:${clientCryptTransformKey}:${accountEncSignPrivKey}`,
        id: accountId,
        kind: 'account',
        signPubKey
      })
      expect(db.getAccount).toBeCalledWith(accountId)
      expect(primitives.cryptTransform).toBeCalledWith(
        clientCryptTransformKey,
        accountEncCryptPrivKey,
        service.signKeyPair
      )
      expect(primitives.cryptTransform).toBeCalledWith(
        clientCryptTransformKey,
        accountEncSignPrivKey,
        service.signKeyPair
      )
    })

    it('returns public keys and client encrypted private keys for group owner', async () => {
      const accountId = 'testAccountId'
      const groupId = 'testGroupId'
      const clientId = 'testClientId'
      const clientCryptTransformKey = 'clientCryptTransformKey'
      const cryptPubKey = 'groupCryptPubKey'
      const groupEncCryptPrivKey = 'groupEncCryptPrivKey'
      const group = {
        accountId,
        cryptPubKey,
        encCryptPrivKey: groupEncCryptPrivKey,
        id: groupId
      }

      const client = {
        accountId,
        clientId,
        cryptTransformKey: clientCryptTransformKey
      }

      db.getGroup = jest.fn().mockResolvedValue(group)
      db.getClient = jest.fn().mockResolvedValue(client)

      const handler = new GetKeyPairs(accountId, clientId, {
        id: groupId,
        kind: 'group'
      })

      expect(await handler.execute(service)).toEqual({
        cryptPubKey,
        encCryptPrivKey: `transformed:${clientCryptTransformKey}:${groupEncCryptPrivKey}`,
        encSignPrivKey: ``,
        id: groupId,
        kind: 'group',
        signPubKey: ''
      })
      expect(db.getClient).toBeCalledWith(clientId)
      expect(db.getGroup).toBeCalledWith(groupId)
      expect(primitives.cryptTransform).toBeCalledWith(
        clientCryptTransformKey,
        groupEncCryptPrivKey,
        service.signKeyPair
      )
    })

    it('returns public keys and client encrypted private keys for group admin', async () => {
      const accountId = 'testAccountId'
      const groupId = 'testGroupId'
      const clientId = 'testClientId'
      const clientCryptTransformKey = 'clientCryptTransformKey'
      const cryptPubKey = 'groupCryptPubKey'
      const groupEncCryptPrivKey = 'groupEncCryptPrivKey'
      const group = {
        accountId: 'someoneElse',
        cryptPubKey,
        encCryptPrivKey: groupEncCryptPrivKey,
        id: groupId
      }

      const memberGroupEncCryptPrivKey = 'memberGroupEncCryptPrivKey'
      const membership = {
        accountId,
        encGroupCryptPrivKey: memberGroupEncCryptPrivKey,
        groupId
      }

      const client = {
        accountId,
        clientId,
        cryptTransformKey: clientCryptTransformKey
      }

      db.getGroup = jest.fn().mockResolvedValue(group)
      db.getClient = jest.fn().mockResolvedValue(client)
      db.getMembership = jest.fn().mockResolvedValue(membership)

      const handler = new GetKeyPairs(accountId, clientId, {
        id: groupId,
        kind: 'group'
      })

      expect(await handler.execute(service)).toEqual({
        cryptPubKey,
        encCryptPrivKey: `transformed:${clientCryptTransformKey}:${memberGroupEncCryptPrivKey}`,
        encSignPrivKey: ``,
        id: groupId,
        kind: 'group',
        signPubKey: ''
      })
      expect(db.getClient).toBeCalledWith(clientId)
      expect(db.getGroup).toBeCalledWith(groupId)
      expect(db.getMembership).toBeCalledWith(groupId, accountId)
      expect(primitives.cryptTransform).toBeCalledWith(
        clientCryptTransformKey,
        memberGroupEncCryptPrivKey,
        service.signKeyPair
      )
    })

    it('throws error for unknown type', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'

      const client = {
        accountId,
        clientId,
        cryptTransformKey: 'doesntmatter'
      }

      db.getClient = jest.fn().mockResolvedValue(client)

      const payload: any = {
        id: 'whatever',
        kind: 'invalid'
      }
      const handler = new GetKeyPairs('anyAccountId', 'anyClientId', payload)

      let success = false

      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Unexpected GetKeyPairs kind'))
      }

      expect(success).toEqual(false)
    })

    it('throws error for unknown client', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'

      db.getClient = jest.fn().mockResolvedValue(null)

      const payload: any = {
        id: 'whatever',
        kind: 'invalid'
      }
      const handler = new GetKeyPairs(accountId, clientId, payload)

      let success = false

      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Client does not exist'))
      }

      expect(success).toEqual(false)
      expect(db.getClient).toBeCalledWith(clientId)
    })

    it('throws error for unkown account', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const clientCryptTransformKey = 'clientCryptTransformKey'

      const client = {
        accountId,
        clientId,
        cryptTransformKey: clientCryptTransformKey
      }

      db.getAccount = jest.fn().mockResolvedValue(null)
      db.getClient = jest.fn().mockResolvedValue(client)

      const handler = new GetKeyPairs(accountId, clientId, {
        id: accountId,
        kind: 'account'
      })

      let success = false
      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Account does not exist'))
      }

      expect(success).toEqual(false)
      expect(db.getClient).toBeCalledWith(clientId)
      expect(db.getAccount).toBeCalledWith(accountId)
    })

    it('throws error for unknown group', async () => {
      const accountId = 'testAccountId'
      const groupId = 'testGroupId'
      const clientId = 'testClientId'
      const clientCryptTransformKey = 'clientCryptTransformKey'
      const client = {
        accountId,
        clientId,
        cryptTransformKey: clientCryptTransformKey
      }

      db.getGroup = jest.fn().mockResolvedValue(null)
      db.getClient = jest.fn().mockResolvedValue(client)

      const handler = new GetKeyPairs(accountId, clientId, {
        id: groupId,
        kind: 'group'
      })

      let success = false
      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Group does not exist'))
      }

      expect(success).toEqual(false)
      expect(db.getGroup).toBeCalledWith(groupId)
    })

    it('throws error for unknown membership', async () => {
      const accountId = 'testAccountId'
      const groupId = 'testGroupId'
      const clientId = 'testClientId'
      const clientCryptTransformKey = 'clientCryptTransformKey'
      const cryptPubKey = 'groupCryptPubKey'
      const groupEncCryptPrivKey = 'groupEncCryptPrivKey'
      const group = {
        accountId: 'someoneElse',
        cryptPubKey,
        encCryptPrivKey: groupEncCryptPrivKey,
        id: groupId
      }

      const client = {
        accountId,
        clientId,
        cryptTransformKey: clientCryptTransformKey
      }

      db.getGroup = jest.fn().mockResolvedValue(group)
      db.getClient = jest.fn().mockResolvedValue(client)
      db.getMembership = jest.fn().mockResolvedValue(null)

      const handler = new GetKeyPairs(accountId, clientId, {
        id: groupId,
        kind: 'group'
      })

      let success = false
      try {
        await handler.execute(service)
        success = true
      } catch (e) {
        expect(e).toEqual(new Error('Membership does not exist'))
      }

      expect(success).toEqual(false)
      expect(db.getMembership).toBeCalledWith(groupId, accountId)
    })
  })
})
