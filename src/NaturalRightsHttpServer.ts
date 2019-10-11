import { NRRequest, NRServiceInterface } from '@natural-rights/common'
import { json, urlencoded } from 'body-parser'
import express from 'express'
import { Server } from 'http'

/**
 * Express based HTTP server for Natural Rights service
 */
export class NaturalRightsHttpServer {
  public service: NRServiceInterface

  constructor(service: NRServiceInterface) {
    this.service = service
  }

  /**
   * Express request handler for Natural Rights service API
   * @param req
   * @param res
   */
  public async handleRequest(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    // TODO: Validate request format?
    const response = await this.service.request(req.body as NRRequest)
    res.json(response)
  }

  /**
   * Listen for natural rights HTTP requests on the given port and host
   */
  public listen(port: number, host: string): Server {
    const app = express()
    app.use(urlencoded({ extended: true }))
    app.use(json())
    const router = express.Router()
    router.post('/', this.handleRequest.bind(this))
    app.use(router)
    return app.listen(port, host)
  }
}
