import {
  NRUpdateDocumentActionPayload,
  NRUpdateDocumentResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class UpdateDocument extends ActionHandler {
  public readonly payload: NRUpdateDocumentActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRUpdateDocumentActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(service: NaturalRightsLocalService): Promise<boolean> {
    if (!this.accountId) {
      return false
    }
    return service.getHasReadAccess(this.accountId, this.payload.documentId)
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRUpdateDocumentResultPayload> {
    const document = (await service.db.getDocument(
      this.payload.documentId
    )) as DocumentRecord

    await service.db.putDocument({
      ...document,
      cryptAccountId: this.payload.cryptAccountId,
      cryptPubKey: this.payload.cryptPubKey,
      encCryptPrivKey: this.payload.encCryptPrivKey,
      id: this.payload.documentId
    })
    return this.payload
  }
}
