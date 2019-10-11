import { NRRemoveMemberFromGroupActionPayload } from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class RemoveMemberFromGroup extends ActionHandler {
  public payload: NRRemoveMemberFromGroupActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRRemoveMemberFromGroupActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(service: NaturalRightsLocalService): Promise<boolean> {
    if (!this.accountId) {
      return false
    }
    if (this.payload.accountId === this.accountId) {
      return true
    }
    return service.getIsGroupAdmin(this.payload.groupId, this.accountId)
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRRemoveMemberFromGroupActionPayload> {
    await service.db.deleteMembership(
      this.payload.groupId,
      this.payload.accountId
    )
    return {
      accountId: this.payload.accountId,
      groupId: this.payload.groupId
    }
  }
}
