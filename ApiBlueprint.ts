import Router from './Router';
import express from 'express';
import { IMountableItem } from '.';

export default class ApiBlueprint implements IMountableItem {
  public path: string = '/docs/blueprint';
  public httpMethod: string = 'get';
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
 
  withOptions(options: {}): this {
    return this;
  }

  asExpressRoute(): (req: express.Request, res: express.Response) => void {
    throw new Error('Not yet implemented');
  }

  asKoaRoute() {
    throw new Error('not yet implemented');
  }

  asMetal() {
    throw new Error('not yet implemented');
  }
}
