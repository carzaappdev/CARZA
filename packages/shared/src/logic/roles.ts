import { DEALER_ROLES, type DealerRole } from '../constants/enums';

/** staff < admin < owner (same order as the Postgres enum). */
export function meetsDealerRole(role: DealerRole, minRole: DealerRole): boolean {
  return DEALER_ROLES.indexOf(role) >= DEALER_ROLES.indexOf(minRole);
}
