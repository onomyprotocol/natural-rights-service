type NRGrantKind = string

interface NaturalRightsDatabaseAdapter {
  get: (soul: string) => Promise<DatabaseRecord>
  put: (soul: string, data: DatabaseRecord) => Promise<void>
  delete: (soul: string) => Promise<void>
  getDocumentGrants: (documentSoul: string) => Promise<readonly GrantRecord[]>
  close: () => void
}

interface NaturalRightsDatabaseInterface {
  getAccount: (id: string) => Promise<AccountRecord | null>
  putAccount: (user: AccountRecord) => Promise<void>
  deleteAccount: (accountId: string) => Promise<void>
  getClient: (clientId: string) => Promise<ClientRecord | null>
  putClient: (client: ClientRecord) => Promise<void>
  deleteClient: (clientId: string) => Promise<void>
  getGroup: (groupId: string) => Promise<GroupRecord | null>
  putGroup: (group: GroupRecord) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  getMembership: (
    groupId: string,
    accountId: string
  ) => Promise<MembershipRecord | null>
  putMembership: (membership: MembershipRecord) => Promise<void>
  deleteMembership: (groupId: string, accountId: string) => Promise<void>
  getDocument: (documentId: string) => Promise<DocumentRecord | null>
  putDocument: (document: DocumentRecord) => Promise<void>
  getDocumentGrants: (documentId: string) => Promise<readonly GrantRecord[]>
  deleteDocument: (documentId: string) => Promise<void>
  getGrant: (
    docId: string,
    kind: NRGrantKind,
    id: string
  ) => Promise<GrantRecord | null>
  putGrant: (grant: GrantRecord) => Promise<void>
  deleteGrant: (docId: string, kind: NRGrantKind, id: string) => Promise<void>
  close: () => void
}

type DatabaseRecord =
  | AccountRecord
  | ClientRecord
  | GroupRecord
  | MembershipRecord
  | DocumentRecord
  | GrantRecord
  | null

interface AccountRecord {
  // /accounts/:accountId
  id: string
  cryptPubKey: string
  signPubKey: string
  encCryptPrivKey: string
  encSignPrivKey: string
  rootDocumentId: string
}

interface ClientRecord {
  // clients/:deviceId
  id: string
  accountId: string
  signPubKey: string
  cryptPubKey: string
  cryptTransformKey: string
}

interface GroupRecord {
  // /groups/:groupId
  id: string // is signPubKey
  accountId: string
  cryptPubKey: string
  encCryptPrivKey: string

  encSignPrivKey: string
}

interface MembershipRecord {
  // /groups/:groupId/memberships/:accountId
  groupId: string
  accountId: string

  cryptTransformKey: string

  canSign: boolean

  // Present for admins
  encGroupCryptPrivKey: string
}

interface DocumentRecord {
  // /documents/:documentId
  id: string // is signPubKey

  cryptAccountId: string
  cryptPubKey: string
  encCryptPrivKey: string

  creatorId: string

  signPrivKey: string
}

interface GrantRecord {
  // /documents/:documentId/grants/:kind/:id
  documentId: string
  id: string // either userId or grantId
  kind: NRGrantKind
  encCryptPrivKey: string

  canSign: boolean
}
