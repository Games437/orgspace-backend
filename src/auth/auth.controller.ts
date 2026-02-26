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
  constructor(private authService: AuthService) { }

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
  // 1. อนุมัติคำขอรีเซ็ตรหัสผ่าน (Admin)
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/request-reset')
  async adminRequestReset(
    @Body('targetUserId') targetUserId: string,
    @Body('requestId') requestId: string, // 👈 เพิ่มการรับ requestId จากหน้าบ้าน
  ) {
    // ส่งทั้ง targetUserId และ requestId ไปที่ Service
    return this.authService.requestPasswordReset(targetUserId, requestId);
  }

  // 2. รับ Token จาก URL และรหัสผ่านใหม่จาก Body
  @Post('reset-password/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }
  // 3. ดึงรายการคำขอรีเซ็ตรหัสผ่านทั้งหมด (สำหรับ Admin ดูที่ Dashboard)
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/reset-requests')
  async getResetRequests() {
    return this.authService.getAllResetRequests();
  }
  @Post('request-reset') // ให้ User ทั่วไปเรียกได้โดยไม่ต้อง Login
async userRequestReset(@Body('userId') userId: string) {
  return this.authService.createUserResetRequest(userId);
}
}
