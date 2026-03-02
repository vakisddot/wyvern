import { WyvernAPI } from './types';

declare global {
  interface Window {
    wyvern: WyvernAPI;
  }
}
