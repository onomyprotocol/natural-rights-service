import { NRResult } from '@natural-rights/common'
import { NaturalRightsLocalService } from '../NaturalRightsLocalService'

/**
 * Abstract definition of ActionHandler interface
 */
export abstract class ActionHandler {
  protected readonly accountId: string
  protected readonly clientId: string

  constructor(accountId: string, clientId: string) {
    this.accountId = accountId
    this.clientId = clientId
  }

  // tslint:disable-next-line: variable-name
  public async checkIsAuthorized(_service: NaturalRightsLocalService): Promise<boolean> {
    return false
  }

  // tslint:disable-next-line: variable-name
  public async execute(_service: NaturalRightsLocalService): Promise<NRResult['payload']> {
    return null
  }
}
