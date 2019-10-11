import {
  NRCreateDocumentActionPayload,
  NRCreateDocumentResultPayload
} from '@natural-rights/common'
import { pair as createPairs } from '@notabug/gun-sear'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class CreateDocument extends ActionHandler {
  public payload: NRCreateDocumentActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRCreateDocumentActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(): Promise<boolean> {
    return (
      !!this.accountId &&
      this.payload.cryptAccountId === this.accountId &&
      this.accountId === this.payload.creatorId
    )
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRCreateDocumentResultPayload> {
    const pairs = await createPairs()
    const signKeyPair = { privKey: pairs.priv, pubKey: pairs.pub }
    const existing = await service.db.getDocument(signKeyPair.pubKey)

    if (existing) {
      throw new Error('Document already exists')
    }

    await service.db.putDocument({
      creatorId: this.payload.creatorId,
      cryptAccountId: this.payload.cryptAccountId,
      cryptPubKey: this.payload.cryptPubKey,
      encCryptPrivKey: this.payload.encCryptPrivKey,
      id: signKeyPair.pubKey,
      signPrivKey: signKeyPair.privKey
    })

    return {
      ...this.payload,
      documentId: signKeyPair.pubKey
    }
  }
}
