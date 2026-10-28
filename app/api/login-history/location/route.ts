import { loginHistorySession } from "../../../../server/auth/login-history";
import { handleLoginLocation } from "../../../../server/http/login-history";

export async function POST(request: Request) {
  return handleLoginLocation(request,loginHistorySession);
}
