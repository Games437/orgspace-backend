// src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException, //
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AuthDto } from './dto/auth.dto';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/enums/role.enum';
import { Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import * as crypto from 'crypto';
import { AuditAction } from 'src/common/enums/audit-action.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) { }

  private normalizeUserId(userId: string) {
    return userId.trim().toLowerCase();
  }

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

  private async storeRefreshHash(userId: string, refreshToken: string) {
    const hash = await argon2.hash(refreshToken);
    await this.usersService.setRefreshTokenHash(userId, hash);
  }

  async signUp(dto: AuthDto) {
    const userId = this.normalizeUserId(dto.userId);

    // 1. เช็กเบื้องต้น (เพื่อความเร็ว)
    const userExists = await this.usersService.findByUserId(userId);
    if (userExists) throw new BadRequestException('User ID นี้ถูกใช้งานแล้ว');

    try {
      const passwordHash = await argon2.hash(dto.password);

      const newUser = await this.usersService.create({
        userId, // ใช้ตัวที่ normalize แล้ว
        passwordHash, // ใช้ hash ที่สร้างใหม่
        role: dto.role || Role.EMPLOYEE, // ถ้า dto ไม่ส่งมา ให้ default เป็น EMPLOYEE
        department: new Types.ObjectId(dto.department), // แปลง department เป็น ObjectId ก่อนบันทึก (ตรวจสอบว่าใน Schema ใช้ชื่อ department นะครับ)
        full_name: dto.full_name,
        salary: dto.salary,
        position: dto.position,
      });

      // 2. ส่วนที่อาจจะเกิด Error Duplicate Key (11000)
      const tokens = await this.signTokens({
        id: String(newUser._id),
        userId: newUser.userId,
        role: newUser.role,
        department: String(newUser.department), // ตรวจสอบว่าใน Schema ใช้ชื่อ department นะครับ
      });

      await this.storeRefreshHash(String(newUser._id), tokens.refreshToken);

      return tokens;
    } catch (error) {
      // 3. ตรวจสอบว่าใช่ Error จาก MongoDB เรื่องข้อมูลซ้ำไหม
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

  async signIn(dto: AuthDto) {
    const userId = this.normalizeUserId(dto.userId);
    const user = await this.usersService.findByUserIdWithSecrets(userId);

    if (!user)
      throw new UnauthorizedException('User ID หรือรหัสผ่านไม่ถูกต้อง');

    // 🔴 1. ตรวจว่าบัญชีถูกล็อกอยู่ไหม
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new ForbiddenException('บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    // 🔴 2. กรณีรหัสผ่านผิด
    if (!passwordMatches) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); //

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

    // ✅ 3. กรณี Login สำเร็จ
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // ✅ บันทึก Log เมื่อ Login สำเร็จ
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

    const tokens = await this.signTokens({
      id: String(user._id),
      userId: user.userId,
      role: user.role,
      department: String(user.department),
    });

    await this.storeRefreshHash(String(user._id), tokens.refreshToken);
    return tokens;
  }

  async refreshTokens(
    userId: string,
    refreshToken: string, // เอา email กับ role ออกจากพารามิเตอร์ได้เลย
  ) {
    if (!refreshToken) throw new UnauthorizedException('Access denied');

    // 1. ดึงข้อมูล User ล่าสุดจาก Database
    const user = await this.usersService.findByIdWithRefresh(userId);
    if (!user?.refreshTokenHash)
      throw new UnauthorizedException('Access denied');

    // 2. ตรวจสอบว่า Refresh Token ตรงกับที่แฮชเก็บไว้ไหม
    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) throw new UnauthorizedException('Access denied');

    // 3. ✅ ใช้ข้อมูลล่าสุดจาก Database (user.email, user.role) สร้าง Token ใหม่
    const tokens = await this.signTokens({
      id: String(user._id),
      userId: user.userId,
      role: user.role,
      department: String(user.department),
    });

    // 4. บันทึก Refresh Token ตัวใหม่ลง Database (Token Rotation)
    await this.storeRefreshHash(userId, tokens.refreshToken);

    return tokens;
  }

  async refreshTokensFromCookie(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException();

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });

      return this.refreshTokens(payload.sub, refreshToken);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
      }
      throw new UnauthorizedException('Token ไม่ถูกต้อง');
    }
  }

  async logout(id: string) {
    await this.usersService.setRefreshTokenHash(id, null);
    return { success: true };
  }

  // เพิ่มฟังก์ชันดึงรายการคำขอทั้งหมด
  async getAllResetRequests() {
    // ในที่นี้สมมติว่าคุณเก็บสถานะไว้ใน User หรือ Schema แยก
    // ถ้าเก็บใน User ให้หาคนที่มี passwordResetExpires > ปัจจุบัน และยังมี Token ค้างอยู่
    return await this.usersService.findAllResetRequests();
    // ^ อย่าลืมไปเพิ่มฟังก์ชันนี้ใน UsersService เพื่อ return รายการคนที่กด "ลืมรหัสผ่าน" มา
  }

  async requestPasswordReset(targetUserId: string, adminFromToken: any, requestId?: string) {
    // 1. ดึงข้อมูล Admin จาก DB ใหม่ (เหมือนที่ resetPassword ทำ)
    const admin = await this.usersService.findById(adminFromToken.id || adminFromToken.sub);
    if (!admin) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ดำเนินการในระบบ');
    }

    // 2. ข้อมูล Admin จะมาครบเหมือนอันที่ผ่านๆ มาแล้วครับ
    const normalizedTargetId = targetUserId.trim().toLowerCase();
    const targetUser = await this.usersService.findByUserId(normalizedTargetId);

    if (!targetUser) {
      throw new BadRequestException('ไม่พบข้อมูลพนักงานที่ต้องการรีเซ็ต');
    }

    // สร้าง Secure Token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // บันทึก Token ลงใน User
    targetUser.passwordResetToken = hashedToken;
    targetUser.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 นาที
    await targetUser.save();

    // 🏆 ส่วนสำคัญ: ถ้ามี requestId ส่งมา (จากตารางคำขอหน้าบ้าน) ให้ทำการปิดงาน
    if (requestId) {
      // ถ้าคุณมี Model ResetRequest ให้ Update สถานะที่นี่
      // await this.resetRequestModel.findByIdAndUpdate(requestId, { status: 'APPROVED' });
      // หรือถ้าใช้ Logic อื่นในการล้าง List หน้าบ้าน ก็จัดการที่นี่ครับ
    }

    // บันทึก Audit Log (ใช้ข้อมูลจาก targetUser)
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

  async resetPassword(token: string, newPassword: string) {
    // 1. สร้าง Hash จาก Token ที่ได้รับมา (ต้องประกาศตัวแปรนี้ก่อนใช้ด้านล่าง)
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 2. เรียกใช้ฟังก์ชันที่ชื่อตรงกับใน UsersService (findByResetToken)
    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Token ไม่ถูกต้องหรือหมดอายุ');
    }

    // 3. เปลี่ยนจาก bcrypt เป็น argon2
    user.passwordHash = await argon2.hash(newPassword);

    // ล้างค่า Token และบังคับ Logout ทุกเครื่อง
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokenHash = undefined;

    await user.save();

    // 4. บันทึก Audit Log เมื่อเปลี่ยนรหัสสำเร็จ
    await this.auditLogsService.log({
      actorId: user._id,
      actorInfo: {
        full_name: user.full_name,
        role: user.role,
        userId: user.userId,
      },
      action: AuditAction.PASSWORD_CHANGE,
      targetId: String(user._id),
      details: `เปลี่ยนรหัสผ่านใหม่สำเร็จผ่านระบบ Password Reset`,
      oldValue: null,
      newValue: null,
    });

    return { success: true, message: 'เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว' };
  }
  async createUserResetRequest(userId: string) {
    const user = await this.usersService.findByUserId(userId.toLowerCase());
    if (!user) throw new BadRequestException('ไม่พบ User ID นี้ในระบบ');

    const hasActiveRequest =
      user.passwordResetToken &&
      user.passwordResetExpires &&
      user.passwordResetExpires > new Date();

    if (hasActiveRequest) {
      throw new BadRequestException('คุณมีคำขอที่รอดำเนินการอยู่แล้ว');
    }

    // 1. บันทึกค่าเก่าไว้ทำ Audit Log (ถ้ามี)
    const oldValue = {
      token: user.passwordResetToken,
      expires: user.passwordResetExpires,
    };

    // 2. เซ็ตค่าสถานะ PENDING
    user.passwordResetToken = 'PENDING';
    user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // ✅ 3. บันทึก Audit Log
    // เนื่องจากผู้ใช้ยังไม่ได้ Login เราจะใช้ข้อมูลจากตัว User ที่ถูกดึงขึ้นมาเป็น Actor
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
}
