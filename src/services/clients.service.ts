import { ClientsRepository } from '../repositories/clients.repository';
import type { CreateClientDto, UpdateClientDto, SearchClientsDto } from '../validators/clients.validators';
import type { Client } from '../types/database';
import type { PaginationMeta } from '../types/api';

export class ClientsService {
  constructor(private readonly repo: ClientsRepository) {}

  async getById(id: string, shopId: string): Promise<Client> {
    return this.repo.findById(id, shopId);
  }

  async search(
    shopId: string,
    params: SearchClientsDto
  ): Promise<{ data: Client[]; meta: PaginationMeta }> {
    const { data, total } = await this.repo.search(shopId, params);
    return {
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        hasMore: params.page * params.limit < total,
      },
    };
  }

  async create(shopId: string, dto: CreateClientDto): Promise<Client> {
    // Si ya existe por teléfono, retornamos el existente (idempotente)
    const existing = await this.repo.findByPhone(dto.phone, shopId);
    if (existing) return existing;
    return this.repo.create(shopId, dto);
  }

  async update(id: string, shopId: string, dto: UpdateClientDto): Promise<Client> {
    return this.repo.update(id, shopId, dto);
  }
}
