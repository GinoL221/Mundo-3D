import { ForeignKeyConstraintError, Op } from 'sequelize';
import { SelectedProductNotFoundException } from '../../domain/exceptions/SelectedProductNotFoundException';
import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import type {
  CustomCommissionRequestAttributes,
  CustomCommissionRequestInstance,
} from '../../database/models/db';

export interface CustomCommissionRequestPersistence {
  CustomCommissionRequest: typeof import('../../database/models/db').CustomCommissionRequest;
}

export class ScopedSequelizeCustomCommissionRequestRepository implements CustomCommissionRequestRepositoryPort {
  constructor(private readonly db: CustomCommissionRequestPersistence) {}

  private toEntity(instance: CustomCommissionRequestInstance): CustomCommissionRequest {
    return new CustomCommissionRequest(
      instance.idCustomCommissionRequest,
      instance.name,
      instance.email,
      instance.idea,
      instance.idProduct ?? null,
      new Date(instance.createdAt),
      new Date(instance.expiresAt),
      instance.phone ?? null,
      instance.idUser ?? null,
    );
  }

  async create(
    request: Omit<CustomCommissionRequest, 'idCustomCommissionRequest'>,
  ): Promise<CustomCommissionRequest> {
    try {
      const instance = await this.db.CustomCommissionRequest.create({
        name: request.name,
        email: request.email,
        phone: request.phone,
        idea: request.idea,
        idProduct: request.idProduct,
        idUser: request.idUser,
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
      } as Partial<CustomCommissionRequestAttributes>);
      return this.toEntity(instance);
    } catch (error) {
      if (request.idProduct != null && error instanceof ForeignKeyConstraintError) {
        throw new SelectedProductNotFoundException();
      }
      throw error;
    }
  }

  async listActive(now: Date): Promise<CustomCommissionRequest[]> {
    const instances = await this.db.CustomCommissionRequest.findAll({
      where: { expiresAt: { [Op.gt]: now } },
      order: [['createdAt', 'DESC']],
    });
    return instances.map((instance) => this.toEntity(instance));
  }

  async listActiveByUser(idUser: number, now: Date): Promise<CustomCommissionRequest[]> {
    const instances = await this.db.CustomCommissionRequest.findAll({
      where: { idUser, expiresAt: { [Op.gt]: now } },
      order: [['createdAt', 'DESC']],
    });
    return instances.map((instance) => this.toEntity(instance));
  }

  async purgeExpired(now: Date): Promise<number> {
    return this.db.CustomCommissionRequest.destroy({
      where: { expiresAt: { [Op.lte]: now } },
    });
  }
}
