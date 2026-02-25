// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Res,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { Request, Response } from 'express';
import { Role } from 'src/common/enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: AuthDto) {
    return this.authService.signUp(dto);
  }

  // จำกัดการยิง signin เพื่อลด brute force
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signin')
  async signin(
    @Body() dto: AuthDto,
    @Res({ passthrough: true }) res: Response, // ใช้ passthrough เพื่อให้ NestJS ยังจัดการ return ค่าได้
  ) {
    const tokens = await this.authService.signIn(dto);

    // ส่ง Refresh Token เข้า Cookie
    //res.cookie('refreshToken', tokens.refreshToken, {
    //  httpOnly: true,
    // secure: process.env.NODE_ENV === 'production',
    //  sameSite: 'strict',
    //  path: '/api/auth/refresh',
    //  maxAge: 7 * 24 * 60 * 60 * 1000,
    //});
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false, // ถ้ายังไม่ใช้ https
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: tokens.accessToken };
  }

  // @UseGuards(AuthGuard('jwt'))
  @UseGuards(AccessTokenGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    return req.user;
  }

  @UseGuards(AccessTokenGuard)
  @Get('profile')
  getMe(@Req() req) {
    return req.user;
  }

  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Get('only')
  getAdmin() {
    return 'admin data';
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refreshToken'];

    const tokens = await this.authService.refreshTokensFromCookie(refreshToken);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: tokens.accessToken };
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('refreshToken', {
      path: '/api/auth/refresh',
    });
    return this.authService.logout(req.user.sub);
  }
  // 1. รับคำขอรีเซ็ตรหัสผ่าน
  @UseGuards(AccessTokenGuard, RolesGuard) // ต้องล็อกอินและเช็ก Role
  @Roles(Role.ADMIN) // เฉพาะ Admin เท่านั้น
  @Post('admin/request-reset')
  async adminRequestReset(
    @Req() req: any, // ดึงข้อมูล Admin จาก JWT
    @Body('targetUserId') targetUserId: string,
  ) {
    // req.user.userId มาจาก payload ของ JWT ตอน login
    return this.authService.requestPasswordReset(req.user.id, targetUserId);
  }

  // 2. รับ Token จาก URL และรหัสผ่านใหม่จาก Body
  @Post('reset-password/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }
}
