import { describe, expect, it } from 'vitest';
import { meetsDealerRole } from './roles';

describe('meetsDealerRole', () => {
  it('orders staff < admin < owner', () => {
    expect(meetsDealerRole('staff', 'staff')).toBe(true);
    expect(meetsDealerRole('staff', 'admin')).toBe(false);
    expect(meetsDealerRole('admin', 'admin')).toBe(true);
    expect(meetsDealerRole('admin', 'owner')).toBe(false);
    expect(meetsDealerRole('owner', 'admin')).toBe(true);
    expect(meetsDealerRole('owner', 'staff')).toBe(true);
  });
});
