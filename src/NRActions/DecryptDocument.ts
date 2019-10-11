import {
  NRDecryptDocumentActionPayload,
  NRDecryptDocumentResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class DecryptDocument extends ActionHandler {
  public payload: NRDecryptDocumentActionPayload

  constructor(
    accountId: string,
    clientId: string,
    payload: NRDecryptDocumentActionPayload
  ) {
    super(accountId, clientId)
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
  ): Promise<NRDecryptDocumentResultPayload> {
    const encCryptPrivKey = await service.getClientDocumentDecryptKey(
      this.clientId,
      this.payload.documentId
    )

    if (!encCryptPrivKey) {
      throw new Error('No access')
    }

    return {
      documentId: this.payload.documentId,
      encCryptPrivKey
    }
  }
}
