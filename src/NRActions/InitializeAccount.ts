import {
  NRInitializeAccountPayload,
  NRInitializeAccountResultPayload
} from '@natural-rights/common'
import { pair as createPairs } from '@notabug/gun-sear'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class InitializeAccount extends ActionHandler {
  public payload: NRInitializeAccountPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRInitializeAccountPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(service: NaturalRightsLocalService): Promise<boolean> {
    if (this.accountId !== this.payload.accountId) {
      return false
    }
    const device = await service.db.getClient(this.clientId)
    if (!device || device.accountId) {
      return false
    }
    const existing = await service.db.getAccount(this.payload.accountId)
    return !existing
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRInitializeAccountResultPayload> {
    const pairs = await createPairs()
    const rootDocSignKeyPair = { privKey: pairs.priv, pubKey: pairs.pub }

    await Promise.all([
      service.db.putAccount({
        cryptPubKey: this.payload.cryptPubKey,
        encCryptPrivKey: this.payload.encCryptPrivKey,
        encSignPrivKey: this.payload.encSignPrivKey,
        id: this.payload.accountId,
        rootDocumentId: rootDocSignKeyPair.pubKey,
        signPubKey: this.payload.signPubKey
      }),

      service.db.putDocument({
        // Private root document
        creatorId: this.payload.accountId,
        cryptAccountId: this.payload.accountId,
        cryptPubKey: this.payload.cryptPubKey,
        encCryptPrivKey: this.payload.encCryptPrivKey,
        id: rootDocSignKeyPair.pubKey,
        signPrivKey: rootDocSignKeyPair.privKey
      })
    ])

    return this.payload
  }
}
