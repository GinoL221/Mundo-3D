import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { SelectedProductNotFoundException } from '../../domain/exceptions/SelectedProductNotFoundException';

export interface CreateCustomCommissionRequestInput {
  name: string;
  email: string;
  idea: string;
  idProduct?: number | null;
}

const RETENTION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class CreateCustomCommissionRequestUseCase {
  private readonly productRepository?: ProductRepositoryPort;
  private readonly clock: () => Date;

  constructor(
    private readonly repository: CustomCommissionRequestRepositoryPort,
    productRepositoryOrClock?: ProductRepositoryPort | (() => Date),
    clock: () => Date = () => new Date(),
  ) {
    if (typeof productRepositoryOrClock === 'function') {
      this.clock = productRepositoryOrClock;
    } else {
      this.productRepository = productRepositoryOrClock;
      this.clock = clock;
    }
  }

  async execute(input: CreateCustomCommissionRequestInput): Promise<CustomCommissionRequest> {
    if (input.idProduct != null && this.productRepository && !(await this.productRepository.findById(input.idProduct))) {
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
