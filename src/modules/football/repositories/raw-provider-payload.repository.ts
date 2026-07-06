import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawProviderPayload } from '../entities/raw-provider-payload.entity';

@Injectable()
export class RawProviderPayloadRepository {
  constructor(
    @InjectRepository(RawProviderPayload)
    private readonly repo: Repository<RawProviderPayload>,
  ) {}

  /** Grava o payload cru; idempotente por (provider, resource, external_ref). */
  async upsert(data: {
    provider: string;
    resource: string;
    externalRef: string;
    payload: unknown;
  }): Promise<void> {
    await this.repo.upsert(
      {
        provider: data.provider,
        resource: data.resource,
        externalRef: data.externalRef,
        payload: data.payload as Record<string, unknown>,
        fetchedAt: new Date(),
        processedAt: null,
      },
      { conflictPaths: ['provider', 'resource', 'externalRef'] },
    );
  }

  async markProcessed(provider: string, resource: string, externalRef: string) {
    await this.repo.update(
      { provider, resource, externalRef },
      { processedAt: new Date() },
    );
  }
}
