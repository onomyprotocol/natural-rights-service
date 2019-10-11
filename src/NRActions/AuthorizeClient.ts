import {
  NRAuthorizeClientActionPayload,
  NRAuthorizeClientResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class AuthorizeClient extends ActionHandler {
  public readonly payload: NRAuthorizeClientActionPayload

  constructor(
    accountId: string,
    clientId: string,
    payload: NRAuthorizeClientActionPayload
  ) {
    super(accountId, clientId)
    this.payload = payload
  }

  public async checkIsAuthorized(service: NaturalRightsLocalService): Promise<boolean> {
    const device = await service.db.getClient(this.payload.clientId)

    if (device && device.accountId && device.accountId !== this.accountId) {
      return false
    }

    return this.payload.accountId === this.accountId
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRAuthorizeClientResultPayload> {
    const device = await service.db.getClient(this.payload.clientId)

    if (!device) {
      throw new Error('Unknown device')
    }

    await service.db.putClient({
      ...device,
      accountId: this.payload.accountId,
      cryptTransformKey: this.payload.cryptTransformKey,
      id: this.payload.clientId
    })

    return this.payload
  }
}
