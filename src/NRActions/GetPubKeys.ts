import {
  NRGetPubKeysActionPayload,
  NRGetPubKeysResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class GetPubKeys extends ActionHandler {
  public readonly payload: NRGetPubKeysActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRGetPubKeysActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(): Promise<boolean> {
    if (!this.accountId) {
      return false
    }
    return true
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRGetPubKeysResultPayload> {
    if (this.payload.kind === 'account') {
      const user = await service.db.getAccount(this.payload.id)
      if (!user) {
        throw new Error('User does not exist')
      }

      return {
        ...this.payload,
        cryptPubKey: user.cryptPubKey,
        signPubKey: user.signPubKey
      }
    } else if (this.payload.kind === 'group') {
      const group = await service.db.getGroup(this.payload.id)
      if (!group) {
        throw new Error('Group does not exist')
      }

      return {
        ...this.payload,
        cryptPubKey: group.cryptPubKey,
        signPubKey: ''
      }
    } else if (this.payload.kind === 'document') {
      const doc = await service.db.getDocument(this.payload.id)
      if (!doc) {
        throw new Error('Document does not exist')
      }

      return {
        ...this.payload,
        cryptPubKey: doc.cryptPubKey,
        signPubKey: doc.id
      }
    } else if (this.payload.kind === 'client') {
      const device = await service.db.getClient(this.payload.id)
      if (!device) {
        throw new Error('Device does not exist')
      }

      return {
        ...this.payload,
        cryptPubKey: device.cryptPubKey,
        signPubKey: device.signPubKey
      }
    }

    throw new Error('Unexpected GetPubKeys kind')
  }
}
