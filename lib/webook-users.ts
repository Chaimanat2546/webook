export interface WebookManagedRole {
  id: number;
  name: string;
}

export interface WebookManagedUser {
  dvId?: string | null;
  email: string;
  id: string;
  name: string;
  roleId: number | null;
  username: string;
}
