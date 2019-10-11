import { Cursor, Env } from 'node-lmdb'

/**
 * LMDB based implementation of Natural Rights service database
 */
export class NaturalRightsLmdbAdapter implements NaturalRightsDatabaseAdapter {
  public env: any
  public dbi: any

  constructor(lmdbConfig: any) {
    this.env = new Env()
    this.env.open(lmdbConfig)
    this.dbi = this.env.openDbi({
      create: true,
      name: 'natural-rights'
    })
  }

  public async transact<T = any>(fn: (txn: any) => T): Promise<T> {
    const txn = this.env.beginTxn()
    try {
      const result = fn(txn)
      txn.commit()
      return result
    } catch (e) {
      txn.abort()
      throw e
    }
  }

  public async cursor<T = void>(
    fn: (txn: any, cursor: Cursor) => T
  ): Promise<T> {
    return this.transact(txn => {
      const cursor = new Cursor(txn, this.dbi)
      try {
        return fn(txn, cursor)
      } catch (e) {
        throw e
      } finally {
        cursor.close()
      }
    })
  }

  public async get(soul: string): Promise<DatabaseRecord> {
    if (!soul) {
      return null
    }

    return this.transact<DatabaseRecord>(txn => {
      const data = this.deserialize(txn.getStringUnsafe(this.dbi, soul))
      return data
    })
  }

  public serialize(node: DatabaseRecord): string {
    if (!node) {
      return ''
    }
    return JSON.stringify(node)
  }

  public deserialize(data: string): DatabaseRecord {
    return JSON.parse(data)
  }

  public async put(soul: string, data: DatabaseRecord): Promise<void> {
    if (!soul) {
      return
    }
    if (!data) {
      return this.delete(soul)
    }

    return this.transact(txn => {
      txn.putString(this.dbi, soul, this.serialize(data))
    })
  }

  public async delete(soul: string): Promise<void> {
    if (!soul) {
      return
    }
    return this.transact(txn => {
      txn.del(this.dbi, soul)
    })
  }

  public async getDocumentGrants(
    documentSoul: string
  ): Promise<readonly GrantRecord[]> {
    return this.cursor((txn, cursor) => {
      cursor.goToKey(documentSoul)
      const grantRe = new RegExp(`${documentSoul}/grants/`)
      let soul = cursor.goToNext()

      // tslint:disable-next-line: readonly-array
      const grants: GrantRecord[] = []

      while (grantRe.test(soul)) {
        grants.push(this.deserialize(
          txn.getStringUnsafe(this.dbi, soul)
        ) as GrantRecord)
        soul = cursor.goToNext()
      }

      return grants.filter(grant => !!grant)
    })
  }

  public close(): void {
    this.dbi.close()
    this.env.close()
  }
}
