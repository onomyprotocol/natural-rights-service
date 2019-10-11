import {
  NRRevokeAccessActionPayload,
  NRRevokeAccessResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class RevokeAccess extends ActionHandler {
  public payload: NRRevokeAccessActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRRevokeAccessActionPayload
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
  ): Promise<NRRevokeAccessResultPayload> {
    await service.db.deleteGrant(
      this.payload.documentId,
      this.payload.kind,
      this.payload.id
    )
    return {
      documentId: this.payload.documentId,
      id: this.payload.id,
      kind: this.payload.kind
    }
  }
}
