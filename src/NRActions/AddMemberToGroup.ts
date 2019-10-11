import {
  NRAddMemberToGroupActionPayload,
  NRAddMemberToGroupResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class AddMemberToGroup extends ActionHandler {
  public payload: NRAddMemberToGroupActionPayload

  constructor(
    accountId: string,
    clientId: string,
    payload: NRAddMemberToGroupActionPayload
  ) {
    super(accountId, clientId)
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
  ): Promise<NRAddMemberToGroupResultPayload> {
    const existing = await service.db.getMembership(
      this.payload.groupId,
      this.payload.accountId
    )
    const membership: MembershipRecord = {
      canSign: false,
      cryptTransformKey: '',
      encGroupCryptPrivKey: '',
      ...existing,
      accountId: this.payload.accountId,
      groupId: this.payload.groupId
    }

    if ('cryptTransformKey' in this.payload) {
      membership.cryptTransformKey = this.payload.cryptTransformKey || ''
    }

    if ('canSign' in this.payload) {
      membership.canSign = this.payload.canSign || false
    }

    await service.db.putMembership(membership)
    return {
      ...this.payload,
      canSign: !!this.payload.canSign
    }
  }
}
