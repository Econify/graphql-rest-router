import Router from './Router';
import express from 'express';

export default interface IMountableItem {
  path: string;
  httpMethod: string;

  at: (path: string) => this;

  asExpressRoute: () => (req: express.Request, res: express.Response) => void;
  asKoaRoute: () => void;
  asMetal: () => void;

  withOptions: (options: any) => this;

  onMount?: (router: Router) => this
}

export interface IMountableItemClass {
  new (options: any, router?: Router): IMountableItem;
}
