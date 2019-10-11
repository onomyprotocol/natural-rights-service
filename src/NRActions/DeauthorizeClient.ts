import {
  NRDeauthorizeClientActionPayload,
  NRDeauthorizeClientResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class DeauthorizeClient extends ActionHandler {
  public payload: NRDeauthorizeClientActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRDeauthorizeClientActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(): Promise<boolean> {
    if (!this.accountId) {
      return this.clientId === this.payload.clientId
    }
    return this.payload.accountId === this.accountId
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRDeauthorizeClientResultPayload> {
    await service.db.deleteClient(this.payload.clientId)
    return {
      accountId: this.payload.accountId,
      clientId: this.payload.clientId
    }
  }
}
