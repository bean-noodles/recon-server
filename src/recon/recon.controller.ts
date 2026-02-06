import { Body, Controller, Post } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';

@Controller('recon')
export class ReconController {
  @Post('site')
  siteRecon(@Body() data: Prisma.SiteCreateInput) {
    return data;
  }
}
