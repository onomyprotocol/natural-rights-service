import {
  NRGetKeyPairsActionPayload,
  NRGetKeyPairsResultPayload
} from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'
import { ActionHandler } from './ActionHandler'

export class GetKeyPairs extends ActionHandler {
  public readonly payload: NRGetKeyPairsActionPayload

  constructor(
    userId: string,
    deviceId: string,
    payload: NRGetKeyPairsActionPayload
  ) {
    super(userId, deviceId)
    this.payload = payload
  }

  public async checkIsAuthorized(service: NaturalRightsLocalService): Promise<boolean> {
    if (!this.accountId) {
      return false
    }
    if (this.payload.kind === 'group') {
      return service.getIsGroupAdmin(this.payload.id, this.accountId)
    }
    if (this.payload.kind === 'account') {
      return this.payload.id === this.accountId
    }
    return false
  }

  public async execute(
    service: NaturalRightsLocalService
  ): Promise<NRGetKeyPairsResultPayload> {
    const device = await service.db.getClient(this.clientId)
    if (!device) {
      throw new Error('Device does not exist')
    }

    if (this.payload.kind === 'account') {
      const user = await service.db.getAccount(this.payload.id)
      if (!user) {
        throw new Error('User does not exist')
      }

      return {
        ...this.payload,
        cryptPubKey: user.cryptPubKey,
        encCryptPrivKey: await service.primitives.cryptTransform(
          device.cryptTransformKey,
          user.encCryptPrivKey,
          service.signKeyPair!
        ),
        encSignPrivKey: await service.primitives.cryptTransform(
          device.cryptTransformKey,
          user.encSignPrivKey,
          service.signKeyPair!
        ),
        signPubKey: user.signPubKey
      }
    } else if (this.payload.kind === 'group') {
      const group = await service.db.getGroup(this.payload.id)
      if (!group) {
        throw new Error('Group does not exist')
      }
      let encCryptPrivKey = ''
      if (group.accountId === this.accountId) {
        encCryptPrivKey = group.encCryptPrivKey
      } else {
        const membership = await service.db.getMembership(
          this.payload.id,
          this.accountId
        )
        if (!membership) {
          throw new Error('Membership does not exist')
        }
        encCryptPrivKey = membership.encGroupCryptPrivKey
      }

      return {
        ...this.payload,
        cryptPubKey: group.cryptPubKey,
        encCryptPrivKey: await service.primitives.cryptTransform(
          device.cryptTransformKey,
          encCryptPrivKey,
          service.signKeyPair!
        ),
        encSignPrivKey: '',
        signPubKey: ''
      }
    }

    throw new Error('Unexpected GetKeyPairs kind')
  }
}
