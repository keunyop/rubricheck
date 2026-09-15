import { getAccountEntitlementByEmail, isActiveProAccountEntitlement } from "../accountEntitlements";

export async function labIsPro(email: string): Promise<boolean> {
  return isActiveProAccountEntitlement(await getAccountEntitlementByEmail(email));
}

