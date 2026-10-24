import { Op } from 'sequelize';
import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import db, {
  CustomCommissionRequestAttributes,
  CustomCommissionRequestInstance,
} from '../../database/models/db';

export class SequelizeCustomCommissionRequestRepository
  implements CustomCommissionRequestRepositoryPort
{
  private toEntity(instance: CustomCommissionRequestInstance): CustomCommissionRequest {
    return new CustomCommissionRequest(
      instance.idCustomCommissionRequest,
      instance.name,
      instance.email,
      instance.idea,
      instance.idProduct ?? null,
      new Date(instance.createdAt),
      new Date(instance.expiresAt),
    );
  }

  async create(
    request: Omit<CustomCommissionRequest, 'idCustomCommissionRequest'>,
  ): Promise<CustomCommissionRequest> {
    const instance = await db.CustomCommissionRequest.create({
      name: request.name,
      email: request.email,
      idea: request.idea,
      idProduct: request.idProduct,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
    } as Partial<CustomCommissionRequestAttributes>);
    return this.toEntity(instance);
  }

  async listActive(now: Date): Promise<CustomCommissionRequest[]> {
    const instances = await db.CustomCommissionRequest.findAll({
      where: { expiresAt: { [Op.gt]: now } },
      order: [['createdAt', 'ASC']],
    });
    return instances.map((instance) => this.toEntity(instance));
  }

  async purgeExpired(now: Date): Promise<number> {
    return db.CustomCommissionRequest.destroy({
      where: { expiresAt: { [Op.lte]: now } },
    });
  }
}
