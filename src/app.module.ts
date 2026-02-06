import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { UserModule } from './user/user.module';
import { UserController } from './user/user.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReconModule } from './recon/recon.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UserModule,
    ReconModule,
  ],
  controllers: [AppController, UserController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
