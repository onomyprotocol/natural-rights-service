import {
  NRAddAdminToGroupActionPayload,
  NRAddAdminToGroupResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

/**
 * Adds an administrator to to a rights management group
 */
export class AddAdminToGroup extends ActionHandler {
  public payload: NRAddAdminToGroupActionPayload

  constructor(
    accountId: string,
    deviceId: string,
    payload: NRAddAdminToGroupActionPayload
  ) {
    super(accountId, deviceId)
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
  ): Promise<NRAddAdminToGroupResultPayload> {
    const membership = await service.db.getMembership(
      this.payload.groupId,
      this.payload.accountId
    )

    if (!membership) {
      throw new Error('No membership for account')
    }

    await service.db.putMembership({
      ...membership,
      encGroupCryptPrivKey: this.payload.encCryptPrivKey
    })

    return this.payload
  }
}
