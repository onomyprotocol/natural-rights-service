import {
  NRGrantAccessActionPayload,
  NRGrantAccessResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class GrantAccess extends ActionHandler {
  public readonly payload: NRGrantAccessActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRGrantAccessActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(
    service: NaturalRightsLocalService
  ): Promise<boolean> {
    if (!this.accountId) {
      return false
    }
    return service.getHasReadAccess(this.accountId, this.payload.documentId)
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRGrantAccessResultPayload> {
    const existing = await service.db.getGrant(
      this.payload.documentId,
      this.payload.kind,
      this.payload.id
    )

    await service.db.putGrant({
      canSign: false,
      encCryptPrivKey: '',
      ...existing,
      ...this.payload
    })

    return this.payload
  }
}
