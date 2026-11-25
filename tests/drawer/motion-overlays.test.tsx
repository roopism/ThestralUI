import { afterEach, beforeAll, expect, test } from 'vitest';

import { cleanup, render } from '@testing-library/react';

import { Drawer } from '../../packages/web/src/motion';

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});

afterEach(cleanup);

test('explicit focus return supports a pointer trigger that never took focus', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  try {
    const { unmount } = render(
      <Drawer
        title="Filters"
        closeLabel="Close"
        returnFocusRef={{ current: trigger }}
        onDismiss={() => {}}
      >
        Topics
      </Drawer>,
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
  } finally {
    trigger.remove();
  }
});
