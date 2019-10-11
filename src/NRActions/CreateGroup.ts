import {
  NRCreateGroupActionPayload,
  NRCreateGroupResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class CreateGroup extends ActionHandler {
  public readonly payload: NRCreateGroupActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRCreateGroupActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(): Promise<boolean> {
    return !!this.accountId && this.payload.accountId === this.accountId
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRCreateGroupResultPayload> {
    await service.db.putGroup({
      accountId: this.payload.accountId,
      cryptPubKey: this.payload.cryptPubKey,
      encCryptPrivKey: this.payload.encCryptPrivKey,
      encSignPrivKey: this.payload.encSignPrivKey,
      id: this.payload.groupId
    })

    return this.payload
  }
}
