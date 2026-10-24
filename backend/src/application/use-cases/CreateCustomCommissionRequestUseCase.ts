import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';
import { SelectedProductNotFoundException } from '../../domain/exceptions/SelectedProductNotFoundException';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';

export interface CreateCustomCommissionRequestInput {
  name: string;
  email: string;
  idea: string;
  idProduct?: number | null;
}

const RETENTION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class CreateCustomCommissionRequestUseCase {
  constructor(
    private readonly repository: CustomCommissionRequestRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
    private readonly productRepository?: ProductRepositoryPort,
  ) {}

  async execute(input: CreateCustomCommissionRequestInput): Promise<CustomCommissionRequest> {
    if (input.idProduct != null && !(await this.productRepository?.findById(input.idProduct))) {
      throw new SelectedProductNotFoundException();
    }

    const createdAt = this.clock();
    return this.repository.create({
      name: input.name,
      email: input.email,
      idea: input.idea,
      idProduct: input.idProduct ?? null,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + RETENTION_DAYS * MILLISECONDS_PER_DAY),
    });
  }
}
