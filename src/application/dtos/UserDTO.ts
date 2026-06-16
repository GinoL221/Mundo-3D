export interface UserDTO {
  IDUser: number;
  FirstName: string;
  LastName: string;
  Email: string;
  Image: string | null;
  IDRole?: number | null;
  Category?: string | null;
}
