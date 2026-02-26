// src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException, //
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

// Internal Imports
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthDto } from './dto/auth.dto';
import { Role } from '../common/enums/role.enum';
import { AuditAction } from 'src/common/enums/audit-action.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ================= CORE AUTHENTICATION (เข้าสู่ระบบ / สมัครสมาชิก) =================

  // ฟังก์ชันสำหรับสมัครสมาชิก (Sign Up)
  async signUp(dto: AuthDto) {
    const userId = this.normalizeUserId(dto.userId);

    // ตรวจสอบก่อนว่ามี User ID นี้ในระบบแล้วหรือยัง (เพื่อป้องกันการแฮชซ้ำและจัดการ Error ได้ถูกต้อง)
    const userExists = await this.usersService.findByUserId(userId);
    if (userExists) throw new BadRequestException('User ID นี้ถูกใช้งานแล้ว');

    try {
      const passwordHash = await argon2.hash(dto.password);

      // สร้าง User ใหม่ใน Database
      const newUser = await this.usersService.create({
        userId,
        passwordHash,
        role: dto.role || Role.EMPLOYEE,
        department: new Types.ObjectId(dto.department),
        full_name: dto.full_name,
        salary: dto.salary,
        position: dto.position,
      });

      // หลังจากสร้าง User สำเร็จแล้ว ให้ทำการสร้าง Token และบันทึก Refresh Token Hash ลง Database
      const tokens = await this.signTokens({
        id: String(newUser._id),
        userId: newUser.userId,
        role: newUser.role,
        department: String(newUser.department), // ตรวจสอบว่าใน Schema ใช้ชื่อ department นะครับ
      });

      // บันทึก Refresh Token Hash ลง Database
      await this.storeRefreshHash(String(newUser._id), tokens.refreshToken);
      return tokens;
    } catch (error) {
      // 🔴 ตรวจสอบ Error Code สำหรับ Duplicate Key (ค่าซ้ำใน MongoDB)
      if (error.code === 11000) {
        // เปลี่ยนจาก 500 เป็น 409 Conflict (ค่าซ้ำ) หรือ 400 ก็ได้ตามใจคุณ
        throw new ConflictException(
          'รหัสพนักงานนี้ถูกลงทะเบียนไปแล้วในฐานข้อมูล',
        );
      }

      // ถ้าเป็น Error อื่นๆ ให้พ่น 500 ตามเดิม
      console.error(error);
      throw error;
    }
  }

  // ฟังก์ชันสำหรับเข้าสู่ระบบ (Sign In)
  async signIn(dto: AuthDto) {
    const userId = this.normalizeUserId(dto.userId);
    const user = await this.usersService.findByUserIdWithSecrets(userId);

    if (!user)
      throw new UnauthorizedException('User ID หรือรหัสผ่านไม่ถูกต้อง');

    // ตรวจว่าบัญชีถูกล็อกอยู่ไหม
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new ForbiddenException('บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    // กรณีรหัสผ่านผิด
    if (!passwordMatches) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // ถ้าใส่รหัสผ่านผิดครบ 5 ครั้ง ให้ล็อกบัญชีชั่วคราว 15 นาที
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);

        // ✅ บันทึก Log เมื่อบัญชีโดนล็อก
        await this.auditLogsService.log({
          actorId: user._id, // ในกรณีนี้คนทำคือตัว User เอง (หรือคนแฮก)
          actorInfo: {
            full_name: user.full_name,
            role: user.role,
            userId: user.userId,
          },
          action: AuditAction.ACCOUNT_LOCKED,
          targetId: String(user._id),
          details: `บัญชีถูกระงับชั่วคราว 15 นาที เนื่องจากใส่รหัสผ่านผิดครบ 5 ครั้ง`,
          oldValue: { failedAttempts: user.failedLoginAttempts - 1 },
          newValue: {
            failedAttempts: user.failedLoginAttempts,
            lockUntil: user.lockUntil,
          },
        });
      }

      await user.save();
      throw new UnauthorizedException('User ID หรือรหัสผ่านไม่ถูกต้อง');
    }

    // กรณี Login สำเร็จ
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // บันทึก Log เมื่อ Login สำเร็จ
    await this.auditLogsService.log({
      actorId: user._id,
      actorInfo: {
        full_name: user.full_name,
        role: user.role,
        userId: user.userId,
      },
      action: AuditAction.LOGIN,
      targetId: String(user._id),
      details: `เข้าสู่ระบบสำเร็จ`,
      oldValue: null,
      newValue: { loginAt: new Date() },
    });

    // สร้าง Access Token และ Refresh Token พร้อมกัน
    const tokens = await this.signTokens({
      id: String(user._id),
      userId: user.userId,
      role: user.role,
      department: String(user.department),
    });

    await this.storeRefreshHash(String(user._id), tokens.refreshToken);
    return tokens;
  }

  // ================= TOKEN MANAGEMENT (Refresh & Logout) =================

  // ฟังก์ชันสำหรับรีเฟรช Token (Refresh Tokens)
  async refreshTokens(userId: string, refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Access denied');

    // ดึงข้อมูลผู้ใช้จาก Database พร้อมกับ Refresh Token Hash
    const user = await this.usersService.findByIdWithRefresh(userId);
    if (!user?.refreshTokenHash)
      throw new UnauthorizedException('Access denied');

    // ตรวจสอบว่า Refresh Token ที่ส่งมา ตรงกับ Hash ที่เก็บไว้ใน Database หรือไม่
    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) throw new UnauthorizedException('Access denied');

    // ถ้า Refresh Token ถูกต้อง ก็สร้าง Access Token และ Refresh Token ตัวใหม่
    const tokens = await this.signTokens({
      id: String(user._id),
      userId: user.userId,
      role: user.role,
      department: String(user.department),
    });

    // บันทึก Refresh Token Hash ตัวใหม่ลง Database (แทนที่ตัวเก่า)
    await this.storeRefreshHash(userId, tokens.refreshToken);

    return tokens;
  }

  // ฟังก์ชันสำหรับรีเฟรช Token โดยดึง Refresh Token จาก Cookie (สำหรับ Frontend ที่เก็บ Refresh Token ใน HttpOnly Cookie)
  async refreshTokensFromCookie(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException();

    // ตรวจสอบและรีเฟรช Token โดยใช้ฟังก์ชัน refreshTokens ที่เราสร้างไว้แล้ว
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });

      // ถ้า Token ถูกต้อง ก็ทำการรีเฟรช Token โดยใช้ userId จาก Payload
      return this.refreshTokens(payload.sub, refreshToken);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
      }
      throw new UnauthorizedException('Token ไม่ถูกต้อง');
    }
  }

  // ฟังก์ชันสำหรับออกจากระบบ (Logout)
  async logout(id: string) {
    // ล้างค่า Refresh Token Hash ใน Database เพื่อให้ Token ที่มีอยู่ทั้งหมดหมดอายุ
    await this.usersService.setRefreshTokenHash(id, null);
    return { success: true };
  }

  // ================= PASSWORD RECOVERY (ลืมรหัสผ่าน / รีเซ็ต) =================

  // ฟังก์ชันสำหรับสร้างคำขอรีเซ็ตรหัสผ่าน (จากหน้า Login)
  async createUserResetRequest(userId: string) {
    const user = await this.usersService.findByUserId(userId.toLowerCase());
    if (!user) throw new BadRequestException('ไม่พบ User ID นี้ในระบบ');

    // ตรวจสอบว่ามีคำขอรีเซ็ตรหัสผ่านที่ยังไม่หมดอายุอยู่แล้วหรือไม่ (ถ้ามีให้ปฏิเสธคำขอใหม่)
    const hasActiveRequest =
      user.passwordResetToken &&
      user.passwordResetExpires &&
      user.passwordResetExpires > new Date();

    if (hasActiveRequest) {
      throw new BadRequestException('คุณมีคำขอที่รอดำเนินการอยู่แล้ว');
    }

    // เก็บค่าเก่าไว้ก่อน (ถ้ามี) เพื่อใช้ใน Audit Log
    const oldValue = {
      token: user.passwordResetToken,
      expires: user.passwordResetExpires,
    };

    // สร้าง Token แบบง่ายๆ (ในที่นี้ใช้ค่า 'PENDING' แทน เพราะยังไม่ได้สร้างลิงก์รีเซ็ตจริงๆ จนกว่า Admin จะอนุมัติ)
    user.passwordResetToken = 'PENDING';
    user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // บันทึก Audit Log ว่ามีการสร้างคำขอรีเซ็ตรหัสผ่านใหม่ (ใช้ข้อมูลจาก User ที่กด "ลืมรหัสผ่าน")
    await this.auditLogsService.log({
      actorId: user._id, // คนที่เป็นเจ้าของบัญชี
      actorInfo: {
        full_name: user.full_name,
        role: user.role,
        userId: user.userId,
      },
      action: AuditAction.REQUEST_RESET_PASSWORD,
      targetId: String(user._id),
      details: `พนักงานส่งคำขอรีเซ็ตรหัสผ่านจากหน้า Login (รอ Admin อนุมัติ)`,
      oldValue: oldValue.token ? oldValue : null,
      newValue: {
        status: 'PENDING',
        expires: user.passwordResetExpires,
      },
    });

    return { message: 'ส่งคำขอสำเร็จ' };
  }

  // ฟังก์ชันสำหรับ Admin อนุมัติคำขอรีเซ็ตรหัสผ่าน (สร้างลิงก์รีเซ็ตและบันทึก Audit Log)
  async requestPasswordReset(targetUserId: string, adminFromToken: any) {
    // ดึงข้อมูล Admin จาก Token เพื่อใช้ใน Audit Log
    const admin = await this.usersService.findById(
      adminFromToken.id || adminFromToken.sub,
    );
    if (!admin) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ดำเนินการในระบบ');
    }

    // ดึงข้อมูลผู้ใช้ที่ต้องการรีเซ็ตจาก Database โดยใช้ User ID ที่ส่งมา (และทำการ Normalize ก่อน)
    const normalizedTargetId = targetUserId.trim().toLowerCase();
    const targetUser = await this.usersService.findByUserId(normalizedTargetId);

    if (!targetUser) {
      throw new BadRequestException('ไม่พบข้อมูลพนักงานที่ต้องการรีเซ็ต');
    }

    // สร้าง Token สำหรับรีเซ็ต (ใช้ crypto สร้างแบบสุ่มและแฮชเก็บใน Database)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // บันทึก Token ลงใน User
    targetUser.passwordResetToken = hashedToken;
    targetUser.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // ลิงก์รีเซ็ตจะหมดอายุใน 15 นาที
    await targetUser.save();

    // บันทึก Audit Log ว่า Admin อนุมัติการรีเซ็ตรหัสผ่านให้พนักงานคนนี้ (ใช้ข้อมูลจาก Admin ที่เป็นคนดำเนินการ และข้อมูลของพนักงานที่ถูกรีเซ็ต)
    await this.auditLogsService.log({
      actorId: admin._id,
      actorInfo: {
        full_name: admin.full_name,
        role: admin.role,
        userId: admin.userId,
      },
      action: AuditAction.PASSWORD_RESET_APPROVED,
      targetId: String(targetUser._id),
      details: `Admin (${admin.userId}) อนุมัติการรีเซ็ตรหัสผ่านให้ ${targetUser.userId}`,
      oldValue: null,
      newValue: { expires: targetUser.passwordResetExpires },
    });
    return {
      message: 'สร้างลิงก์รีเซ็ตสำเร็จ',
      token: resetToken, // 👈 ส่ง token กลับไปเพื่อให้หน้าบ้านเอาไปต่อ URL
    };
  }

  // ฟังก์ชันสำหรับรีเซ็ตรหัสผ่านจริงๆ (จากลิงก์ที่ Admin สร้างให้)
  async resetPassword(token: string, newPassword: string) {
    // 1. สร้าง Hash จาก Token เพื่อหาตัวผู้ใช้
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Token ไม่ถูกต้องหรือหมดอายุ');
    }

    // เพิ่มการเช็ครหัสผ่านใหม่ว่าซ้ำกับของเดิมไหม
    // โดยใช้ argon2.verify(รหัสที่แฮชแล้วใน DB, รหัสใหม่ที่ส่งมา)
    const isSameAsOld = await argon2.verify(user.passwordHash, newPassword);

    if (isSameAsOld) {
      throw new BadRequestException('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    }

    // 3. ถ้าไม่ซ้ำ ก็ทำการแฮชรหัสใหม่และบันทึก
    user.passwordHash = await argon2.hash(newPassword);

    // ล้างค่า Token และสถานะต่างๆ
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokenHash = undefined;

    await user.save();

    // 4. บันทึก Audit Log (ตามโค้ดเดิมของคุณ)
    await this.auditLogsService.log({
      actorId: user._id,
      actorInfo: {
        full_name: user.full_name,
        role: user.role,
        userId: user.userId,
      },
      action: AuditAction.PASSWORD_CHANGE,
      targetId: String(user._id),
      details: `เปลี่ยนรหัสผ่านใหม่สำเร็จ (ตรวจสอบแล้วว่าไม่ซ้ำกับของเดิม)`,
      oldValue: null,
      newValue: null,
    });

    return { success: true, message: 'เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว' };
  }

  // เพิ่มฟังก์ชันดึงรายการคำขอทั้งหมด
  async getAllResetRequests() {
    return await this.usersService.findAllResetRequests();
  }

  // ================= INTERNAL UTILITIES =================

  // ฟังก์ชันสำหรับ Normalize User ID (เช่น แปลงเป็นตัวพิมพ์เล็กและตัดช่องว่าง) เพื่อให้การตรวจสอบ User ID มีความยืดหยุ่นมากขึ้น
  private normalizeUserId(userId: string) {
    return userId.trim().toLowerCase();
  }

  // ฟังก์ชันสำหรับสร้าง Access Token และ Refresh Token พร้อมกัน
  private async signTokens(user: {
    id: string;
    userId: string;
    role: Role;
    department: string;
  }) {
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');

    const accessExp = parseInt(
      this.config.get<string>('JWT_ACCESS_EXPIRATION') ?? '900',
      10,
    );
    const refreshExp = parseInt(
      this.config.get<string>('JWT_REFRESH_EXPIRATION') ?? '604800',
      10,
    );

    const payload = {
      sub: user.id,
      role: user.role,
      department: user.department,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExp,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExp,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // ฟังก์ชันสำหรับแฮชและบันทึก Refresh Token Hash ลง Database
  private async storeRefreshHash(userId: string, refreshToken: string) {
    const hash = await argon2.hash(refreshToken);
    await this.usersService.setRefreshTokenHash(userId, hash);
  }
}
