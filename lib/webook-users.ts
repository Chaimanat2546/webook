export interface WebookManagedRole {
  id: number;
  name: string;
}

export interface WebookManagedUser {
  email: string;
  id: string;
  name: string;
  roleId: number | null;
  username: string;
}
