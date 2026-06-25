import { SchedulesRepository, BusinessConfigRepository } from '../repositories/schedules.repository';
import type { UpdateScheduleDto, BulkUpdateScheduleDto, BulkUpdateConfigDto } from '../validators/shared.validators';
import type { BarberSchedule, BusinessConfig } from '../types/database';

// ── Schedules ─────────────────────────────────────────────────

export class SchedulesService {
  constructor(private readonly repo: SchedulesRepository) {}

  async getByShop(shopId: string, barberId?: string): Promise<BarberSchedule[]> {
    return this.repo.findByShop(shopId, barberId);
  }

  async update(shopId: string, barberId: string, dto: UpdateScheduleDto): Promise<BarberSchedule> {
    return this.repo.upsert(shopId, barberId, dto);
  }

  async bulkUpdate(
    shopId: string,
    barberId: string,
    dtos: BulkUpdateScheduleDto
  ): Promise<BarberSchedule[]> {
    return this.repo.bulkUpsert(shopId, barberId, dtos);
  }
}

// ── Business Config ───────────────────────────────────────────

export class BusinessConfigService {
  constructor(private readonly repo: BusinessConfigRepository) {}

  async getAll(shopId: string, isAdmin: boolean): Promise<BusinessConfig[]> {
    return this.repo.findAll(shopId, isAdmin);
  }

  async getMap(shopId: string): Promise<Record<string, string>> {
    return this.repo.getMap(shopId);
  }

  async update(shopId: string, dtos: BulkUpdateConfigDto): Promise<BusinessConfig[]> {
    return this.repo.upsert(shopId, dtos);
  }
}
