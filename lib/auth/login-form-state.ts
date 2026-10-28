export interface LoginFormState {
  status: "idle" | "invalid" | "request_error";
  identifier: string;
  field?: "identifier" | "adminCredential";
}
export const INITIAL_LOGIN_STATE: LoginFormState = { status: "idle", identifier: "" };
