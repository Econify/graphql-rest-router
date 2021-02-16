import express from 'express';

import Router from './Router';
import { IMountableItem } from './types';

export default class ApiBlueprint implements IMountableItem {
  public path = '/docs/blueprint';
  public httpMethod = 'get';
  protected router: Router;

  constructor() {
    throw new Error('not yet implemented');
  }

  onMount(router: Router): this {
    this.router = router;

    return this;
  }

  at(path: string): this {
    this.path = path;

    return this;
  }

  // This doesn't do anything yet?
  withOptions(options: Record<string, unknown>): this {

    return this;
  }

  asExpressRoute(): ((req: express.Request, res: express.Response) => void) | never {
    throw new Error('Not yet implemented');
  }

  asKoaRoute(): ((req: express.Request, res: express.Response) => void) | never {
    throw new Error('not yet implemented');
  }

  asMetal(): ((req: express.Request, res: express.Response) => void) | never {
    throw new Error('not yet implemented');
  }
}
