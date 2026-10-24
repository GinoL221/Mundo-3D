import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';

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
  ) {}

  async execute(input: CreateCustomCommissionRequestInput): Promise<CustomCommissionRequest> {
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
