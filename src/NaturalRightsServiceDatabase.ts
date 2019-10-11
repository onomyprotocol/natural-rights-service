const PREFIX = ``

export const Souls = {
  account: (accountId: string) => `${PREFIX}/accounts/${accountId}`,
  client: (clientId: string) => `${PREFIX}/clients/${clientId}`,
  document: (documentId: string) => `${PREFIX}/documents/${documentId}`,
  grant: (documentId: string, kind: NRGrantKind, id: string) =>
    `${PREFIX}/documents/${documentId}/grants/${kind}/${id}`,
  group: (groupId: string) => `${PREFIX}/groups/${groupId}`,
  membership: (groupId: string, accountId: string) =>
    `${PREFIX}/groups/${groupId}/members/${accountId}`
}

/**
 * Natural Rights Service Database
 */
export class NaturalRightsServiceDatabase implements NaturalRightsDatabaseInterface {
  protected adapter: NaturalRightsDatabaseAdapter

  constructor(adapter: NaturalRightsDatabaseAdapter) {
    this.adapter = adapter
  }

  /**
   * Get an account record for a given id if present
   *
   * @param accountId unique identifier of the account to load
   */
  public async getAccount(accountId: string): Promise<AccountRecord | null> {
    const soul = Souls.account(accountId)
    const account = await this.adapter.get(soul)
    if (!account) {
      return null
    }
    return account as AccountRecord
  }

  /**
   * Save an account record to the database
   *
   * Overwrites existing data for the same account id
   *
   * @param account the account record to save
   */
  public async putAccount(account: AccountRecord): Promise<void> {
    const soul = Souls.account(account.id)
    await this.adapter.put(soul, account)
  }

  /**
   * Delete an account from the database
   *
   * @param accountId unique identifier of the account to delete
   */
  public async deleteAccount(accountId: string): Promise<void> {
    const soul = Souls.account(accountId)
    await this.adapter.delete(soul)
  }

  /**
   * Load a client record for a given id if present
   *
   * @param clientId unique identifier of the client to load
   */
  public async getClient(clientId: string): Promise<ClientRecord | null> {
    const soul = Souls.client(clientId)
    const client = await this.adapter.get(soul)
    if (!client) {
      return null
    }
    return client as ClientRecord
  }

  /**
   * Save a client record to the database
   *
   * Overwrites existing data for the same client id
   *
   * @param client the client record to save
   */
  public async putClient(client: ClientRecord): Promise<void> {
    const soul = Souls.client(client.id)
    await this.adapter.put(soul, client)
  }

  /**
   * Delete a client from the database
   *
   * @param clientId unique identifier of the client to delete
   */
  public async deleteClient(clientId: string): Promise<void> {
    const soul = Souls.client(clientId)
    await this.adapter.delete(soul)
  }

  /**
   * Load a group record for a given id if present
   *
   * @param groupId unique identifier of the group to load
   */
  public async getGroup(groupId: string): Promise<GroupRecord | null> {
    const soul = Souls.group(groupId)
    const group = await this.adapter.get(soul)
    if (!group) {
      return null
    }
    return group as GroupRecord
  }

  /**
   * Save a group record to the database
   *
   * Overwrites existing data for the same group id
   *
   * @param group the group record to save
   */
  public async putGroup(group: GroupRecord): Promise<void> {
    const soul = Souls.group(group.id)
    await this.adapter.put(soul, group)
  }

  /**
   * Delete a group from the database
   *
   * @param groupId unique identifier of the group to delete
   */
  public async deleteGroup(groupId: string): Promise<void> {
    const soul = Souls.group(groupId)
    await this.adapter.delete(soul)
  }

  /**
   * Load a membership record for a given id if present
   *
   * @param groupId unique identifier of the group to load membership from
   * @param accountId unique idenitifier of the account to load membership for
   */
  public async getMembership(
    groupId: string,
    accountId: string
  ): Promise<MembershipRecord | null> {
    const soul = Souls.membership(groupId, accountId)
    const membership = await this.adapter.get(soul)
    if (!membership) {
      return null
    }
    return membership as MembershipRecord
  }

  /**
   * Save a membership record to the database
   *
   * Overwrites existing data for the same groupId/accountId combo
   *
   * @param membership the membership record to save
   */
  public async putMembership(membership: MembershipRecord): Promise<void> {
    const soul = Souls.membership(membership.groupId, membership.accountId)
    await this.adapter.put(soul, membership)
  }

  /**
   * Delete a membership from the database
   *
   * @param groupId unique identifier of the group to load membership from
   * @param accountId unique idenitifier of the account to load membership for
   */
  public async deleteMembership(
    groupId: string,
    accountId: string
  ): Promise<void> {
    const soul = Souls.membership(groupId, accountId)
    await this.adapter.delete(soul)
  }

  /**
   * Load a document record for a given id if present
   *
   * @param documentId unique identifier of the document to load
   */
  public async getDocument(documentId: string): Promise<DocumentRecord | null> {
    const soul = Souls.document(documentId)
    const document = await this.adapter.get(soul)
    if (!document) {
      return null
    }
    return document as DocumentRecord
  }

  /**
   * Save a document record to the database
   *
   * Overwrites existing data for the same document id
   *
   * @param document the document record to save
   */
  public async putDocument(document: DocumentRecord): Promise<void> {
    const soul = Souls.document(document.id)
    await this.adapter.put(soul, document)
  }

  /**
   * Delete a document from the database
   *
   * @param documentId unique identifier of the document to delete
   */
  public async deleteDocument(documentId: string): Promise<void> {
    const soul = Souls.document(documentId)
    await this.adapter.delete(soul)
  }

  public async getDocumentGrants(
    documentId: string
  ): Promise<readonly GrantRecord[]> {
    const soul = Souls.document(documentId)
    return this.adapter.getDocumentGrants(soul)
  }

  /**
   * Load a grant record for a given documentId/kind/id if present
   *
   * @param documentId unique identifier of the document to load a grant from
   * @param kind kind of grant to add
   * @param id unique identifier of the grantee
   */
  public async getGrant(
    documentId: string,
    kind: NRGrantKind,
    id: string
  ): Promise<GrantRecord | null> {
    const soul = Souls.grant(documentId, kind, id)
    const grant = await this.adapter.get(soul)
    if (!grant) {
      return null
    }
    return grant as GrantRecord
  }

  /**
   * Save a grant record to the database
   *
   * Overwrites existing data for the same documentId/kind/id
   *
   * @param grant the grant record to save
   */
  public async putGrant(grant: GrantRecord): Promise<void> {
    const soul = Souls.grant(grant.documentId, grant.kind, grant.id)
    await this.adapter.put(soul, grant)
  }

  /**
   * Delete a document from the database
   *
   * @param documentId unique identifier of the document to delete a grant from
   * @param kind kind of grant to delete
   * @param id unique identifier of the grantee
   */
  public async deleteGrant(
    documentId: string,
    kind: NRGrantKind,
    id: string
  ): Promise<void> {
    const soul = Souls.grant(documentId, kind, id)
    await this.adapter.delete(soul)
  }

  /**
   * Clean up when done with this database
   */
  public close(): void {
    this.adapter.close()
  }
}
