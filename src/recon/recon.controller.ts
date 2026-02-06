import { Body, Controller, Post } from '@nestjs/common';
import { ReconService } from './recon.service';

@Controller('recon')
export class ReconController {
  constructor(private readonly reconService: ReconService) {}

  @Post('site')
  async siteRecon(
    @Body() data: { title: string; url: string; description: string },
  ) {
    return this.reconService.siteRecon(data);
  }
}
