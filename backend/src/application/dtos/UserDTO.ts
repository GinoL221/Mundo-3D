export interface UserDTO {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  idRole?: number | null;
  category?: string | null;
}
