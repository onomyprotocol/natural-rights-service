// tslint:disable: no-string-literal
import {
  NRAuthorizeClientAction,
  NRCreateDocumentAction,
  NRGrantAccessAction,
  NRInitializeAccountAction,
  NRLoginAction,
  PREPrimitivesInterface
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { CreateDocument } from '../NRActions'
import { ActionHandler } from '../NRActions/ActionHandler'

describe('NaturalRightsLocalService', () => {
  let primitives: PREPrimitivesInterface
  let db: NaturalRightsDatabaseInterface
  let dbAdapter: NaturalRightsDatabaseAdapter
  let service: NaturalRightsLocalService

  beforeEach(() => {
    primitives = {
      cryptKeyGen: jest.fn().mockResolvedValue({
        privKey: 'cryptPrivKey',
        pubKey: 'cryptPubKey'
      }),
      cryptTransform: jest.fn(),
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

  describe('authenticateLogin', () => {
    it('returns empty string if request is Login request and only login request with valid client signature', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const actions: readonly [NRLoginAction] = [
        {
          payload: {
            cryptPubKey: ''
          },
          type: 'Login'
        }
      ]
      const signature = 'expectedSignature'
      const request = {
        accountId,
        body: JSON.stringify(actions),
        clientId,
        signature
      }

      jest.spyOn(service.primitives, 'verify').mockResolvedValue(true)

      expect(await service['authenticate'](request)).toEqual('')
    })

    it('returns false if request is not login request', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const actions: readonly any[] = [
        {
          payload: {},
          type: 'AnythingElse'
        }
      ]
      const signature = 'expectedSignature'
      const request = {
        accountId,
        body: JSON.stringify(actions),
        clientId,
        signature
      }

      jest.spyOn(service.primitives, 'verify').mockResolvedValue(true)

      expect(await service['authenticate'](request)).toEqual(false)
    })
  })

  describe('authenticate', () => {
    const accountId = 'testAccountId'
    const accountCryptPubKey = 'accountCryptPubKey'
    const accountSignPubKey = 'accountSignPubKey'
    const accountEncCryptPrivKey = 'accountEncCryptPrivKey'
    const accountEncSignPrivKey = 'accountEncSignPrivKey'
    const clientId = 'testClientId'
    const clientCryptTransformKey = 'clientCryptTransformKey'
    const rootDocCryptPubKey = ''
    const rootDocEncCryptPrivKey = ''

    const actions: readonly [
      NRInitializeAccountAction,
      NRAuthorizeClientAction
    ] = [
      {
        payload: {
          accountId,
          cryptPubKey: accountCryptPubKey,
          encCryptPrivKey: accountEncCryptPrivKey,
          encSignPrivKey: accountEncSignPrivKey,
          rootDocCryptPubKey,
          rootDocEncCryptPrivKey,
          signPubKey: accountSignPubKey
        },
        type: 'InitializeAccount'
      },
      {
        payload: {
          accountId,
          clientId,
          cryptTransformKey: clientCryptTransformKey
        },
        type: 'AuthorizeClient'
      }
    ]
    const signature = 'expectedSignature'
    const request = {
      accountId,
      body: JSON.stringify(actions),
      clientId,
      signature
    }

    it('returns accountId if the request is signed by valid account', async () => {
      const clientRecord: ClientRecord = {
        accountId,
        cryptPubKey: 'clientCryptPubKey',
        cryptTransformKey: 'clientCryptTransformKey',
        id: clientId,
        signPubKey: 'clientSignPubKey'
      }

      // @ts-ignore
      const spy = jest.spyOn(service, 'authenticateLogin')
      spy.mockResolvedValue(false)

      db.getClient = jest.fn().mockResolvedValue(clientRecord)

      jest.spyOn(service.primitives, 'verify').mockResolvedValue(true)

      expect(await service['authenticate'](request)).toEqual(accountId)
      expect(primitives.verify).toBeCalledWith(
        clientRecord.signPubKey,
        request.signature,
        request.body
      )
      expect(service['authenticateLogin']).not.toBeCalled()
    })

    it('returns false if the request is not signed by valid account', async () => {
      const clientRecord: ClientRecord = {
        accountId,
        cryptPubKey: 'clientCryptPubKey',
        cryptTransformKey: 'clientCryptTransformKey',
        id: clientId,
        signPubKey: 'clientSignPubKey'
      }

      // @ts-ignore
      const spy = jest.spyOn(service, 'authenticateLogin')
      spy.mockResolvedValue(false)

      db.getClient = jest.fn().mockResolvedValue(clientRecord)
      jest.spyOn(service.primitives, 'verify').mockResolvedValue(false)

      expect(await service['authenticate'](request)).toEqual(false)
      expect(primitives.verify).toBeCalledWith(
        clientRecord.signPubKey,
        request.signature,
        request.body
      )
      expect(service['authenticateLogin']).not.toBeCalled()
    })

    it('defers to authenticateInitialAccount if client cannot be found', async () => {
      // @ts-ignore
      const spy = jest.spyOn(service, 'authenticateLogin')
      spy.mockResolvedValue(true)

      expect(await service['authenticate'](request)).toEqual(true)
      expect(service['authenticateLogin']).toBeCalledWith(request)
    })
  })

  describe('request', () => {
    const accountId = 'testAccountId'
    const actions: readonly [NRCreateDocumentAction, NRGrantAccessAction] = [
      {
        payload: {
          creatorId: accountId,
          cryptAccountId: accountId,
          cryptPubKey: '',
          encCryptPrivKey: 'testEncCryptPrivKey'
        },
        type: 'CreateDocument'
      },
      {
        payload: {
          documentId: 'testOocumentId',
          encCryptPrivKey: 'test2EncCryptPrivKey',
          id: 'testAccount2Id',
          kind: 'account'
        },
        type: 'GrantAccess'
      }
    ]

    const request = {
      accountId: 'testAccountId',
      body: JSON.stringify(actions),
      clientId: 'testClientId',
      signature: 'testSignature'
    }

    it('Returns an authentication error for each action if request is not authenticated', async () => {
      // @ts-ignore
      const authSpy = jest.spyOn(service, 'authenticate')
      authSpy.mockResolvedValue(false)

      // @ts-ignore
      const paSpy = jest.spyOn(service, 'processAction')
      // tslint:disable-next-line: variable-name
      paSpy.mockImplementation(async (_req: any, action: any) => action)

      expect(await service.request(request)).toEqual({
        results: actions.map(result => ({
          ...result,
          error: 'Authentication error',
          success: false
        }))
      })
      expect(service['authenticate']).toBeCalledWith(request)
      expect(service['processAction']).not.toBeCalled()
    })

    it('processes actions in body if request authenticates', async () => {
      // @ts-ignore
      const authSpy = jest.spyOn(service, 'authenticate')
      authSpy.mockResolvedValue(accountId)

      // @ts-ignore
      const paSpy = jest.spyOn(service, 'processAction')
      // tslint:disable-next-line: variable-name
      paSpy.mockImplementation(async (_req: any, action: any) => action)

      expect(await service.request(request)).toEqual({
        results: actions
      })
      expect(service['authenticate']).toBeCalledWith(request)
      actions.map(action =>
        expect(service['processAction']).toBeCalledWith(
          request,
          action,
          accountId
        )
      )
    })
  })

  describe('getActionHandler', () => {
    const accountId = 'testAccountId'
    const clientId = 'testClientId'
    const action: NRCreateDocumentAction = {
      payload: {
        creatorId: accountId,
        cryptAccountId: accountId,
        cryptPubKey: '',
        encCryptPrivKey: 'testEncCryptPrivKey'
      },
      type: 'CreateDocument'
    }

    const request = {
      accountId,
      body: JSON.stringify([action]),
      clientId,
      signature: 'testSignature'
    }

    it('returns null if action type is not valid', async () => {
      const invalidAction = JSON.parse('{ "type": "InvalidAction" }')
      expect(
        service['getActionHandler'](request, invalidAction, accountId)
      ).toEqual(null)
    })

    it('returns ActionHandler instance if type is valid', async () => {
      expect(service['getActionHandler'](request, action, accountId)).toEqual(
        new CreateDocument(accountId, clientId, action.payload)
      )
    })
  })

  describe('processAction', () => {
    class MyHandler extends ActionHandler {}
    const accountId = 'testAccountId'
    const clientId = 'testClientId'
    const handler = new MyHandler(accountId, clientId)
    const action: NRCreateDocumentAction = {
      payload: {
        creatorId: accountId,
        cryptAccountId: accountId,
        cryptPubKey: '',
        encCryptPrivKey: 'testEncCryptPrivKey'
      },
      type: 'CreateDocument'
    }

    const request = {
      accountId,
      body: JSON.stringify([action]),
      clientId,
      signature: 'testSignature'
    }

    it('returns an unauthorized error if action is not authorized', async () => {
      handler.checkIsAuthorized = jest.fn().mockResolvedValue(false)
      handler.execute = jest.fn()

      // @ts-ignore
      jest.spyOn(service, 'getActionHandler').mockReturnValue(handler)

      expect(
        await service['processAction'](request, action, accountId)
      ).toEqual({
        ...action,
        error: 'Unauthorized',
        success: false
      })
      expect(handler.checkIsAuthorized).toBeCalled()
      expect(service['getActionHandler']).toBeCalledWith(
        request,
        action,
        accountId
      )
      expect(handler.execute).not.toBeCalled()
    })

    it('executes the action if it is authorized', async () => {
      handler.checkIsAuthorized = jest.fn().mockResolvedValue(true)
      // @ts-ignore
      jest.spyOn(service, 'getActionHandler').mockReturnValue(handler)

      handler.execute = jest.fn().mockResolvedValue(action.payload)

      expect(
        await service['processAction'](request, action, accountId)
      ).toEqual({
        ...action,
        error: '',
        success: true
      })
      expect(handler.checkIsAuthorized).toBeCalled()
      expect(service['getActionHandler']).toBeCalledWith(
        request,
        action,
        accountId
      )
      expect(handler.execute).toBeCalledWith(service)
    })

    it('returns an error if action is invalid', async () => {
      const invalidAction = JSON.parse('{ "type": "InvalidAction" }')
      expect(
        await service['processAction'](request, invalidAction, accountId)
      ).toEqual({
        ...invalidAction,
        error: 'Invalid action type',
        success: false
      })
    })
  })

  describe('getIsGroupAdmin', () => {
    it('Resolves true if account is admin of group', async () => {
      const groupId = 'testGroupId'
      const testAccountId = 'testAccountId'
      db.getMembership = jest.fn().mockResolvedValue({
        accountId: testAccountId,

        cryptTransformKey: 'cryptTransformKey',

        encGroupCryptPrivKey: 'validityofthisisnotchecked',
        groupId
      })

      db.getGroup = jest.fn().mockResolvedValue({ groupId })

      const isGroupAdmin = await service.getIsGroupAdmin(groupId, testAccountId)

      expect(isGroupAdmin).toEqual(true)
      expect(db.getMembership).toBeCalledWith(groupId, testAccountId)
    })

    it('Resolves false if account not admin of group', async () => {
      const groupId = 'testGroupId'
      const testAccountId = 'testAccountId'
      db.getMembership = jest.fn().mockResolvedValue({
        accountId: testAccountId,
        groupId,

        cryptTransformKey: 'cryptTransformKey',

        encGroupCryptPrivKey: ''
      })

      const isGroupAdmin = await service.getIsGroupAdmin(groupId, testAccountId)

      expect(isGroupAdmin).toEqual(false)
      expect(db.getMembership).toBeCalledWith(groupId, testAccountId)
    })

    it('Resolves false if account not a member', async () => {
      const groupId = 'testGroupId'
      const testAccountId = 'testAccountId'
      const isGroupAdmin = await service.getIsGroupAdmin(groupId, testAccountId)

      expect(isGroupAdmin).toEqual(false)
    })
  })

  describe('getCredentials', () => {
    it('resolves undefined if account has no access to document', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      const document = {
        accountId: 'someOtherAccount',
        documentId,
        encCryptPrivKey: 'docEncCryptPrivKey'
      }
      db.getDocument = jest.fn().mockResolvedValue(document)
      db.getDocumentGrants = jest.fn().mockResolvedValue([])

      expect(await service.getCredentials(accountId, documentId)).toEqual(null)
      expect(db.getDocument).toBeCalledWith(documentId)
      expect(db.getDocumentGrants).toBeCalledWith(documentId)
    })

    it('resolves undefined if document does not exist', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      db.getDocument = jest.fn().mockResolvedValue(undefined)
      db.getDocumentGrants = jest.fn().mockResolvedValue([])

      expect(await service.getCredentials(accountId, documentId)).toEqual(null)
      expect(db.getDocument).toBeCalledWith(documentId)
      expect(db.getDocumentGrants).toBeCalledWith(documentId)
    })

    it('resolves { document } if account is owner of document', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      const document = {
        cryptAccountId: accountId,
        documentId,
        encCryptPrivKey: 'docEncCryptPrivKey'
      }
      db.getDocument = jest.fn().mockResolvedValue(document)
      db.getDocumentGrants = jest.fn().mockResolvedValue([])

      expect(await service.getCredentials(accountId, documentId)).toEqual({
        document
      })
      expect(db.getDocument).toBeCalledWith(documentId)
      expect(db.getDocumentGrants).toBeCalledWith(documentId)
    })

    it('resolves { document, grant } if account is directly granted access to document', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      const document = {
        accountId: 'someOtherAccount',
        documentId,
        encCryptPrivKey: 'docEncCryptPrivKey'
      }
      const grant = {
        id: accountId,
        kind: 'account'
      }

      db.getMembership = jest.fn().mockResolvedValue(null)
      db.getDocument = jest.fn().mockResolvedValue(document)
      db.getDocumentGrants = jest.fn().mockResolvedValue([
        {
          id: 'someOtherId',
          kind: 'account'
        },
        {
          id: 'someRandomGroup',
          kind: 'group'
        },
        grant
      ])

      expect(await service.getCredentials(accountId, documentId)).toEqual({
        document,
        grant
      })
      expect(db.getDocument).toBeCalledWith(documentId)
      expect(db.getDocumentGrants).toBeCalledWith(documentId)
      expect(db.getMembership).toBeCalledWith('someRandomGroup', accountId)
    })

    it('resolves { document, grant, membership } if account is granted access to document via a group', async () => {
      const accountId = 'testAccountId'
      const groupId = 'testGroupId'
      const documentId = 'testDocumentId'
      const document = {
        accountId: 'someOtherAccount',
        documentId,
        encCryptPrivKey: 'docEncCryptPrivKey'
      }
      const grant = {
        id: groupId,
        kind: 'group'
      }
      const membership = {
        accountId,
        groupId
      }

      db.getMembership = jest.fn().mockResolvedValue(membership)
      db.getDocument = jest.fn().mockResolvedValue(document)
      db.getDocumentGrants = jest.fn().mockResolvedValue([
        {
          id: 'someOtherId',
          kind: 'account'
        },
        grant
      ])

      expect(await service.getCredentials(accountId, documentId)).toEqual({
        document,
        grant,
        membership
      })
      expect(db.getDocument).toBeCalledWith(documentId)
      expect(db.getDocumentGrants).toBeCalledWith(documentId)
      expect(db.getMembership).toBeCalledWith(groupId, accountId)
    })
  })

  describe('getAccountDocumentDecryptKey', () => {
    it("resolves '' if account has no access to document", async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      service.getCredentials = jest.fn().mockResolvedValue(undefined)

      expect(
        await service.getAccountDocumentDecryptKey(accountId, documentId)
      ).toEqual('')
      expect(service.getCredentials).toBeCalledWith(accountId, documentId)
    })

    it('resolves document.encCryptPrivKey if account is owner of document', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      const document = { encCryptPrivKey: 'docEncCryptPrivKey' }
      service.getCredentials = jest.fn().mockResolvedValue({ document })

      expect(
        await service.getAccountDocumentDecryptKey(accountId, documentId)
      ).toEqual(document.encCryptPrivKey)
      expect(service.getCredentials).toBeCalledWith(accountId, documentId)
    })

    it('resolves grant.encCryptPrivKey if account is directly granted access to document', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      const document = { encCryptPrivKey: 'docEncCryptPrivKey' }
      const grant = { encCryptPrivKey: 'grantEncCryptPrivKey' }
      service.getCredentials = jest.fn().mockResolvedValue({ document, grant })

      expect(
        await service.getAccountDocumentDecryptKey(accountId, documentId)
      ).toEqual(grant.encCryptPrivKey)
      expect(service.getCredentials).toBeCalledWith(accountId, documentId)
    })

    it('resolves transformed key if account is granted access to document via a group', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'
      const document = { encCryptPrivKey: 'docEncCryptPrivKey' }
      const grant = { encCryptPrivKey: 'grantEncCryptPrivKey' }
      const membership = {
        cryptTransformKey: 'memberCryptTransformKey',
        encCryptPrivKey: 'memberEncCryptPrivKey'
      }
      const transformedKey = 'transformedCryptPrivKey'
      service.getCredentials = jest
        .fn()
        .mockResolvedValue({ document, grant, membership })

      jest.spyOn(primitives, 'cryptTransform').mockResolvedValue(transformedKey)

      expect(
        await service.getAccountDocumentDecryptKey(accountId, documentId)
      ).toEqual(transformedKey)
      expect(service.getCredentials).toBeCalledWith(accountId, documentId)
      expect(primitives.cryptTransform).toBeCalledWith(
        membership.cryptTransformKey,
        grant.encCryptPrivKey,
        service.signKeyPair
      )
    })
  })

  describe('getClientDocumentDecryptKey', () => {
    it("resolves '' if the client does not exist", async () => {
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      db.getClient = jest.fn().mockResolvedValue(null)
      service.getAccountDocumentDecryptKey = jest
        .fn()
        .mockResolvedValue('letspretendthisexists')

      expect(
        await service.getClientDocumentDecryptKey(clientId, documentId)
      ).toEqual('')
      expect(db.getClient).toBeCalledWith(clientId)
    })

    it("resolves '' if the account has no access to document", async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      db.getClient = jest.fn().mockResolvedValue({
        accountId,
        cryptTransformKey: 'clientCryptTransformKey',
        id: clientId
      })
      service.getAccountDocumentDecryptKey = jest.fn().mockResolvedValue('')

      expect(
        await service.getClientDocumentDecryptKey(clientId, documentId)
      ).toEqual('')
      expect(db.getClient).toBeCalledWith(clientId)
    })

    it('resolves a document key transformed to client if account has access', async () => {
      const accountId = 'testAccountId'
      const clientId = 'testClientId'
      const documentId = 'testDocumentId'
      const clientRecord = {
        accountId,
        cryptTransformKey: 'clientCryptTransformKey',
        id: clientId
      }
      db.getClient = jest.fn().mockResolvedValue(clientRecord)
      const accountEncCryptPrivKey = 'accountEncCryptPrivKey'
      const clientEncCryptPrivKey = 'clientEncCryptPrivKey'

      jest
        .spyOn(primitives, 'cryptTransform')
        .mockResolvedValue(clientEncCryptPrivKey)
      jest
        .spyOn(service, 'getAccountDocumentDecryptKey')
        .mockResolvedValue(accountEncCryptPrivKey)

      expect(
        await service.getClientDocumentDecryptKey(clientId, documentId)
      ).toEqual(clientEncCryptPrivKey)
      expect(service.getAccountDocumentDecryptKey).toBeCalledWith(
        accountId,
        documentId
      )
      expect(primitives.cryptTransform).toBeCalledWith(
        clientRecord.cryptTransformKey,
        accountEncCryptPrivKey,
        service.signKeyPair
      )
    })
  })

  describe('getHasReadAccess', () => {
    it('resolves true if getAccountDocumentDecryptKey resolves truthy', async () => {
      const accountId = 'testAccountId'
      const documentId = 'testDocumentId'

      service.getAccountDocumentDecryptKey = jest
        .fn()
        .mockResolvedValue(undefined)
      expect(await service.getHasReadAccess(accountId, documentId)).toEqual(
        false
      )
      expect(service.getAccountDocumentDecryptKey).toBeCalledWith(
        accountId,
        documentId
      )

      service.getAccountDocumentDecryptKey = jest
        .fn()
        .mockResolvedValue('shouldntmatter')
      expect(await service.getHasReadAccess(accountId, documentId)).toEqual(
        true
      )
      expect(service.getAccountDocumentDecryptKey).toBeCalledWith(
        accountId,
        documentId
      )
    })
  })
})
