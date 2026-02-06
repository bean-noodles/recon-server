import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { User } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async register(data: Prisma.UserCreateInput): Promise<User> {
    if ((await this.getUser({ id: data.id })) != null) {
      throw new ConflictException('해당 유저가 이미 존재합니다.');
    } else {
      return this.prisma.user.create({ data });
    }
  }

  async getUser(data: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return this.prisma.user.findUnique({ where: data });
  }
}
