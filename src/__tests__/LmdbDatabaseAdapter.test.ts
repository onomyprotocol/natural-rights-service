// tslint:disable: no-var-requires
import { NaturalRightsLmdbAdapter } from '../NaturalRightsLmdbAdapter'
import { Souls } from '../NaturalRightsServiceDatabase'

const path = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

describe('LmdbDatabaseAdapter', () => {
  const testDirPath = path.resolve(__dirname, './testdata')
  let db: NaturalRightsLmdbAdapter

  beforeEach(async () => {
    await new Promise((ok, fail) =>
      rimraf(testDirPath, (err: any) => {
        if (err) {
          return fail(err)
        }
        mkdirp(testDirPath, (error: any) => (error ? fail(error) : ok()))
      })
    )

    db = new NaturalRightsLmdbAdapter({
      path: testDirPath
    })
  })

  afterEach(async () => {
    if (db) {
      db.close()
    }
    await new Promise(ok => rimraf(testDirPath, ok))
  })

  it('can get, put and delete records', async () => {
    const record = {
      accountId: 'accountId',
      cryptPubKey: 'cryptPubKey',
      encCryptPrivKey: 'encCryptPrivKey',
      encSignPrivKey: 'encSignPrivKey',
      id: 'documentId'
    }
    const soul = 'testsoul'

    expect(await db.get('')).toEqual(null)
    expect(await db.get(soul)).toEqual(null)
    await db.put(soul, record)
    expect(await db.get(soul)).toEqual(record)
    await db.delete(soul)
    expect(await db.get(soul)).toEqual(null)
  })

  describe('put', () => {
    it('calls delete if data is falsy', async () => {
      const soul = 'testsoul'

      db.delete = jest.fn().mockResolvedValue(undefined)

      await db.put(soul, null)

      expect(db.delete).toBeCalledWith(soul)
    })

    it('resolves undefined if no soul passed', async () => {
      const record = {
        accountId: 'accountId',
        cryptPubKey: 'cryptPubKey',
        encCryptPrivKey: 'encCryptPrivKey',
        encSignPrivKey: 'encSignPrivKey',
        id: 'documentId'
      }

      expect(await db.put('', record)).toEqual(undefined)
    })
  })

  describe('delete', () => {
    it('resolves undefined if no soul is passed', async () => {
      expect(await db.delete('')).toEqual(undefined)
    })
  })

  describe('getDocumentGrants', () => {
    it('resolves grant records for a given document soul', async () => {
      const documentId = 'testDocumentId'
      const document = {
        accountId: 'testAccountId',
        cryptPubKey: 'cryptPubKey',

        encCryptPrivKey: 'encCryptPrivKey',
        encSignPrivKey: 'encSignPrivKey',
        id: documentId
      }

      const someOtherDoc = {
        accountId: 'testAccountId',
        cryptPubKey: 'cryptPubKey',

        encCryptPrivKey: 'encCryptPrivKey',
        encSignPrivKey: 'encSignPrivKey',
        id: 'someOtherDoc'
      }

      const expectedGrants: readonly GrantRecord[] = [
        {
          canSign: true,
          documentId,
          encCryptPrivKey: '',
          id: 'group1',
          kind: 'group'
        },
        {
          canSign: true,
          documentId,
          encCryptPrivKey: '',
          id: 'group2',
          kind: 'group'
        },
        {
          canSign: true,
          documentId,
          encCryptPrivKey: '',
          id: 'account1',
          kind: 'account'
        },
        {
          canSign: true,
          documentId,
          encCryptPrivKey: '',
          id: 'account2',
          kind: 'account'
        }
      ]

      const unexpectedGrants: readonly GrantRecord[] = [
        {
          canSign: true,
          documentId: 'someOtherDoc',
          encCryptPrivKey: '',
          id: 'group1',
          kind: 'group'
        },
        {
          canSign: true,
          documentId: 'someOtherDoc',
          encCryptPrivKey: '',
          id: 'group2',
          kind: 'group'
        },
        {
          canSign: true,
          documentId: 'someOtherDoc',
          encCryptPrivKey: '',
          id: 'account1',
          kind: 'account'
        },
        {
          canSign: true,
          documentId: 'someOtherDoc',
          encCryptPrivKey: '',
          id: 'account2',
          kind: 'account'
        }
      ]

      const allGrants: readonly GrantRecord[] = [
        ...expectedGrants,
        ...unexpectedGrants
      ]

      await db.put(Souls.document(document.id), document)
      await db.put(Souls.document(someOtherDoc.id), someOtherDoc)

      for (const grant of allGrants) {
        await db.put(Souls.grant(grant.documentId, grant.kind, grant.id), grant)
      }

      expect(await db.getDocumentGrants(Souls.document(document.id))).toEqual(
        expectedGrants
      )
    })
  })

  describe('lmdb specifics', () => {
    describe('transact', () => {
      it('aborts if errors thrown in transaction and rethrows', async () => {
        const txn = { abort: jest.fn() }
        db.env.beginTxn = jest.fn().mockReturnValue(txn)
        const error = new Error('Expected Error')
        const fn = jest.fn().mockImplementation(() => {
          throw error
        })

        let success = false
        try {
          await db.transact(fn)
          success = true
        } catch (e) {
          expect(e).toEqual(error)
        }

        expect(fn).toBeCalledWith(txn)
        expect(success).toEqual(false)
        expect(txn.abort).toBeCalled()
      })
    })

    describe('cursor', () => {
      it('aborts if errors thrown in transaction and rethrows', async () => {
        const error = new Error('Expected Error')
        const fn = jest.fn().mockImplementation(() => {
          throw error
        })

        let success = false
        try {
          await db.cursor(fn)
          success = true
        } catch (e) {
          expect(e).toEqual(error)
        }

        expect(success).toEqual(false)
      })
    })

    describe('serialize', () => {
      it("returns '' if node is falsy", () => {
        expect(db.serialize(null)).toEqual('')
      })
    })
  })
})
