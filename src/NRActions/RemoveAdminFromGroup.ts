import {
  NRRemoveAdminFromGroupActionPayload,
  NRRemoveAdminFromGroupResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class RemoveAdminFromGroup extends ActionHandler {
  public payload: NRRemoveAdminFromGroupActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRRemoveAdminFromGroupActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(service: NaturalRightsLocalService): Promise<boolean> {
    if (!this.accountId) {
      return false
    }
    return service.getIsGroupAdmin(this.payload.groupId, this.accountId)
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRRemoveAdminFromGroupResultPayload> {
    const membership = await service.db.getMembership(
      this.payload.groupId,
      this.payload.accountId
    )
    if (membership) {
      await service.db.putMembership({
        ...membership,
        encGroupCryptPrivKey: ''
      })
    }
    return {
      accountId: this.payload.accountId,
      groupId: this.payload.groupId
    }
  }
}
