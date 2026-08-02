import { describe, expect, it } from 'vitest';

import { APP_NAME } from '@scuttlebutt/shared-types';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

describe('web foundation', () => {
  it('exposes the product name and app-shell selector', () => {
    expect(APP_NAME).toBe('Scuttlebutt');
    expect(E2E_SELECTORS.appShell).toBe('app-shell');
  });
});
