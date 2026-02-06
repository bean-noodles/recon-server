import { Body, Controller, Get, Post } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { User } from 'src/generated/prisma/client';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() data: Prisma.UserCreateInput): Promise<User> {
    return this.userService.register(data);
  }

  @Get('getAllUsers')
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @Post('getUser')
  async getUser(
    @Body() data: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.userService.getUser(data);
  }
}
