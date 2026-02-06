import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReconService {
  constructor(private readonly prisma: PrismaService) {}

  async siteRecon(data: Prisma.SiteCreateInput) {}
}
