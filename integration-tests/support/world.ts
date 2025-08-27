import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { AxiosResponse } from 'axios';

export interface CustomWorld extends World {
  response?: AxiosResponse;
  baseURL: string;
}

export class CustomWorldConstructor extends World implements CustomWorld {
  public response?: AxiosResponse;
  public baseURL: string;

  constructor(options: IWorldOptions) {
    super(options);
    this.baseURL = process.env.TEST_BASE_URL || 'http://localhost:4000';
  }
}

setWorldConstructor(CustomWorldConstructor);