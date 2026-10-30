/**
 * Who may be recorded as the attending vet. Only a doctor or the clinic admin (who may treat). A receptionist or
 * accountant who opens a visit must never end up as "Attending Veterinarian" on the Rx and the bill, so for them this
 * gives "" and the vet is chosen from the approved doctors list instead.
 */
const VET_ROLES = ["doctor", "admin"];

export const isVetRole = (roleId?: string | null): boolean => !!roleId && VET_ROLES.includes(roleId);

export const vetNameOf = (user?: { roleId?: string | null; fullName?: string | null } | null): string =>
  user && isVetRole(user.roleId) ? user.fullName || "" : "";
