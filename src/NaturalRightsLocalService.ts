import {
  NRAction,
  NRInitializeAccountAction,
  NRKeyPair,
  NRRequest,
  NRResponse,
  NRResult,
  NRServiceInterface,
  PREPrimitivesInterface
} from '@natural-rights/common'
import { NaturalRightsServiceDatabase } from './NaturalRightsServiceDatabase'
import * as actions from './NRActions'
import { ActionHandler } from './NRActions/ActionHandler'

function isValidActionType(type: string): type is keyof typeof actions {
  return type in actions
}

/**
 * Primary implementation of Natural Rights service running on this machine
 */
export class NaturalRightsLocalService implements NRServiceInterface {
  public readonly primitives: PREPrimitivesInterface
  public readonly db: NaturalRightsServiceDatabase

  public signKeyPair?: NRKeyPair // TODO initialize/track

  constructor(
    primitives: PREPrimitivesInterface,
    adapter: NaturalRightsDatabaseAdapter
  ) {
    this.primitives = primitives
    this.db = new NaturalRightsServiceDatabase(adapter)
  }

  /**
   * Execute a request against this service
   *
   * @param req the request to execute
   * @returns a Natural Rights response object
   */
  public async request(req: NRRequest): Promise<NRResponse> {
    // tslint:disable-next-line: readonly-array
    const results: NRResult[] = []
    const requestActions = this.parseRequestBody(req)
    const accountId = await this.authenticate(req)

    if (accountId === false) {
      // signature failed validation
      return {
        results: requestActions.map(reqAction => ({
          error: 'Authentication error',
          payload: reqAction.payload,
          success: false,
          type: reqAction.type
        })) as readonly NRResult[]
      }
    }

    for (const action of requestActions) {
      results.push(await this.processAction(req, action, accountId))
    }

    return { results }
  }

  /**
   * Determine if an account admins a group
   *
   * @param groupId
   * @param accountId
   */
  public async getIsGroupAdmin(
    groupId: string,
    accountId: string
  ): Promise<boolean> {
    const [group, membership] = await Promise.all([
      this.db.getGroup(groupId),
      this.db.getMembership(groupId, accountId)
    ])
    if (group && group.accountId === accountId) {
      return true
    }
    return !!(group && membership && membership.encGroupCryptPrivKey)
  }

  /**
   * Get credential data for a document if the given account has it
   *
   * @param accountId
   * @param documentId
   * @returns an object with relevant data or null
   */
  public async getCredentials(
    accountId: string,
    documentId: string
  ): Promise<null | {
    document: DocumentRecord
    grant?: GrantRecord
    membership?: MembershipRecord
  }> {
    const [document, grants] = await Promise.all([
      this.db.getDocument(documentId),
      this.db.getDocumentGrants(documentId)
    ])

    if (!document) {
      return null
    }

    if (document.cryptAccountId === accountId) {
      return { document }
    }

    for (const grant of grants) {
      if (grant.kind === 'account') {
        if (grant.id === accountId) {
          return { document, grant }
        }
        continue
      }

      const membership = await this.db.getMembership(grant.id, accountId)

      if (membership) {
        return { document, grant, membership }
      }
    }

    return null
  }

  /**
   * Get/transform a document encryption key for a specific account
   *
   * @param accountId the account to transform for
   * @param documentId the document to get a decryption key for
   * @returns the transformed encrypted decryption key
   */
  public async getAccountDocumentDecryptKey(
    accountId: string,
    documentId: string
  ): Promise<string> {
    const credentials = await this.getCredentials(accountId, documentId)
    if (!credentials) {
      return ''
    }
    if (!credentials.grant) {
      return credentials.document.encCryptPrivKey
    }
    if (!credentials.membership) {
      return credentials.grant.encCryptPrivKey
    }
    return this.primitives.cryptTransform(
      credentials.membership.cryptTransformKey,
      credentials.grant.encCryptPrivKey,
      this.signKeyPair!
    )
  }

  /**
   * Get/transform a document encryption key for a specific client
   *
   * @param clientId
   * @param documentId
   * @returns the transformed encrypted decryption key
   */
  public async getClientDocumentDecryptKey(
    clientId: string,
    documentId: string
  ): Promise<string> {
    const client = await this.db.getClient(clientId)
    if (!client || !client.accountId) {
      return ''
    }
    const accountKey = await this.getAccountDocumentDecryptKey(
      client.accountId,
      documentId
    )

    if (!accountKey) {
      return ''
    }
    return this.primitives.cryptTransform(
      client.cryptTransformKey,
      accountKey,
      this.signKeyPair!
    )
  }

  /**
   * Determine if an account has read access to a document
   *
   * @param accountId unique identifier of the account to check access for
   * @param documentId unique identifier of the document to check access for
   * @returns true if a account has read access to the document, false otherwise
   */
  public async getHasReadAccess(
    accountId: string,
    documentId: string
  ): Promise<boolean> {
    return !!(await this.getAccountDocumentDecryptKey(accountId, documentId))
  }

  /**
   * Determine if an account has sign access to a document
   *
   * @param accountId unique identifier of the account to check access for
   * @param documentId unique identifier of the document to check access for
   * @returns true if a account has sign access to the document, false otherwise
   */
  public async getHasSignAccess(
    accountId: string,
    documentId: string
  ): Promise<boolean> {
    const credentials = await this.getCredentials(accountId, documentId)
    if (!credentials) {
      return false
    }
    const { document, membership, grant } = credentials
    if (document.creatorId === accountId) {
      return true
    }
    if (!grant || !grant.canSign) {
      return false
    }
    if (membership) {
      return membership.canSign
    }
    return grant.canSign
  }

  protected getActionHandler(
    req: NRRequest,
    action: NRAction,
    accountId: string
  ): ActionHandler | null {
    if (!isValidActionType(action.type)) {
      return null
    }

    const ActionType: any = actions[action.type]
    return new ActionType(accountId, req.clientId, action.payload)
  }

  protected parseRequestBody(req: NRRequest): readonly NRAction[] {
    return JSON.parse(req.body)
  }

  protected async authenticateLogin(req: NRRequest): Promise<false | ''> {
    const requestActions = this.parseRequestBody(req)
    const loginActions = requestActions.filter(
      action => action.type === 'Login'
    )
    if (
      requestActions.length !== loginActions.length ||
      loginActions.length !== 1
    ) {
      return false
    }
    if (await this.primitives.verify(req.clientId, req.signature, req.body)) {
      return ''
    }
    return false
  }

  protected async authenticate(req: NRRequest): Promise<string | false> {
    const client = await this.db.getClient(req.clientId)
    if (!client || !client.signPubKey) {
      return this.authenticateLogin(req)
    }
    const requestActions = this.parseRequestBody(req)
    const initializeAccountActions = requestActions.filter(
      action => action.type === 'InitializeAccount'
    )
    if (initializeAccountActions.length > 1) {
      return false
    }

    if (
      await this.primitives.verify(client.signPubKey, req.signature, req.body)
    ) {
      if (client.accountId) {
        return client.accountId
      }

      if (initializeAccountActions.length === 1) {
        const initAccountAction = initializeAccountActions[0]
        if (initAccountAction !== requestActions[0]) {
          return false
        }
        const initAccount = (initializeAccountActions[0] as NRInitializeAccountAction)
          .payload
        const existing = await this.db.getAccount(initAccount.accountId)
        if (!existing) {
          return initAccount.accountId
        }
      }

      return ''
    }
    return false
  }

  protected async processAction(
    req: NRRequest,
    action: NRAction,
    accountId: string
  ): Promise<NRResult> {
    const handler = this.getActionHandler(req, action, accountId)
    if (!handler) {
      return {
        error: 'Invalid action type',
        payload: action.payload,
        success: false,
        type: action.type
      }
    }
    if (!(await handler.checkIsAuthorized(this))) {
      return {
        error: 'Unauthorized',
        payload: action.payload,
        success: false,
        type: action.type
      }
    }
    try {
      // @ts-ignore Not sure why this is barfing
      return {
        error: '',
        payload: await handler.execute(this),
        success: true,
        type: action.type
      }
    } catch (error) {
      return {
        error,
        payload: action.payload,
        success: false,
        type: action.type
      }
    }
  }
}
