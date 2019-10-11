import {
  NRSignDocumentActionPayload,
  NRSignDocumentResultPayload
} from '@natural-rights/common'
import { signHash } from '@notabug/gun-sear'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class SignDocument extends ActionHandler {
  public payload: NRSignDocumentActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRSignDocumentActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(service: NaturalRightsLocalService): Promise<boolean> {
    if (!this.accountId) {
      return false
    }
    const canSign = await service.getHasSignAccess(
      this.accountId,
      this.payload.documentId
    )
    if (canSign) {
      return true
    }
    return false
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRSignDocumentResultPayload> {
    const documentRecord = await service.db.getDocument(this.payload.documentId)
    const signKeyPair = {
      privKey: documentRecord!.signPrivKey,
      pubKey: documentRecord!.id
    }

    return {
      ...this.payload,
      signatures: await Promise.all(
        this.payload.hashes.map(hash =>
          signHash(hash, {
            priv: signKeyPair.privKey,
            pub: signKeyPair.pubKey
          })
        )
      )
    }
  }
}
