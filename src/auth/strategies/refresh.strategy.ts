import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// ปรับปรุง Type ให้ตรงกับ Payload จริงที่ใช้อยู่ในระบบ
type JwtPayload = {
  sub: string;
  role: string;
  department: string;
};

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(readonly config: ConfigService) {
    super({
      // ดึงจาก Header (Bearer Token) ตามโค้ดเดิม
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // เพื่อให้ฟังก์ชัน validate รับ req ได้
    });
  }

  validate(req: Request, payload: JwtPayload) {
    // ดึง Refresh Token ตัวเต็มจาก Header เพื่อเอาไปตรวจสอบ (Verify) กับ Hash ใน Database
    const refreshToken = req
      ?.get('authorization')
      ?.replace('Bearer', '')
      .trim();

    return {
      id: payload.sub,
      role: payload.role,
      department: payload.department,
      refreshToken,
    };
  }
}
