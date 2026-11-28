import { CustomCommissionRequest } from '../entities/CustomCommissionRequest';

export interface CustomCommissionRequestRepositoryPort {
  create(
    request: Omit<CustomCommissionRequest, 'idCustomCommissionRequest'>,
  ): Promise<CustomCommissionRequest>;
  listActive(now: Date): Promise<CustomCommissionRequest[]>;
  listActiveByUser(idUser: number, now: Date): Promise<CustomCommissionRequest[]>;
  purgeExpired(now: Date): Promise<number>;
}
