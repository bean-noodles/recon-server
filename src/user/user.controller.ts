import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Post('login')
  async login(@Body() data: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return this.userService.login(data);
  }

  @Get()
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @Get(':id')
  async getUser(@Param('id') id: string): Promise<User | null> {
    return this.userService.getUser({ id });
  }
}
