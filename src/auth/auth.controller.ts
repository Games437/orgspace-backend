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
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

// Service
import { AuthService } from './auth.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

// DTO & Enums
import { AuthDto } from './dto/auth.dto';
import { Role } from 'src/common/enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ================= AUTHENTICATION & SESSIONS =================

  @Post('signup')
  signup(@Body() dto: AuthDto) {
    return this.authService.signUp(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // จำกัดการเรียกใช้งาน endpoint นี้ไม่เกิน 10 ครั้งต่อ 1 นาที ต่อ IP
  @Post('signin')
  async signin(
    @Body() dto: AuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signIn(dto);

    // ตั้งค่า refresh token ใน HttpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false, // ถ้ายังไม่ใช้ https
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: tokens.accessToken };
  }

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้สามารถรีเฟรช access token ได้โดยใช้ refresh token ที่เก็บใน cookie
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

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้สามารถออกจากระบบได้
  @UseGuards(AccessTokenGuard)
  @Post('logout')
  logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('refreshToken', {
      path: '/api/auth/refresh',
    });
    return this.authService.logout(req.user.sub);
  }

  // ================= PROFILE =================

  // เพิ่ม endpoint นี้เพื่อให้ผู้ใช้ที่ล็อกอินแล้วสามารถดูข้อมูลโปรไฟล์ของตัวเองได้
  @UseGuards(AccessTokenGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    return req.user;
  }

  // ================= PASSWORD RECOVERY (User & Admin) =================

  // User ส่งคำขอขอรีเซ็ต (หน้า Login)
  @Post('request-reset') // ให้ User ทั่วไปเรียกได้โดยไม่ต้อง Login
  async userRequestReset(@Body('userId') userId: string) {
    return this.authService.createUserResetRequest(userId);
  }

  // พนักงานกดลิงก์จาก URL เพื่อเปลี่ยนรหัสผ่านจริง
  @Post('reset-password/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }

  // Admin ดูรายการคำขอทั้งหมด
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/reset-requests')
  async getResetRequests() {
    return this.authService.getAllResetRequests();
  }

  // Admin อนุมัติการรีเซ็ตรหัสผ่านให้พนักงาน
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/request-reset')
  async adminRequestReset(
    @Body('targetUserId') targetUserId: string,
    @Body('requestId') requestId: string,
    @Req() req: any,
  ) {
    // ✅ ส่ง req.user เข้าไปเป็นพารามิเตอร์ตัวที่ 2
    return this.authService.requestPasswordReset(
      targetUserId,
      req.user,
    );
  }
}
