import {
  NRLoginActionPayload,
  NRLoginActionResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class Login extends ActionHandler {
  public readonly payload: NRLoginActionPayload

  constructor(userId: string, deviceId: string, payload: NRLoginActionPayload) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(): Promise<boolean> {
    return true
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRLoginActionResultPayload> {
    if (!this.payload.cryptPubKey) {
      throw new Error('No device cryptPubKey')
    }

    const client = {
      accountId: '',
      cryptPubKey: this.payload.cryptPubKey,
      cryptTransformKey: '',
      id: this.clientId,
      ...(await service.db.getClient(this.clientId)),
      signPubKey: this.clientId
    }
    const { accountId } = client
    const [user] = await Promise.all([
      service.db.getAccount(accountId),
      service.db.putClient(client)
    ])

    return {
      accountId,
      rootDocumentId: user ? user.rootDocumentId : ''
    }
  }
}
