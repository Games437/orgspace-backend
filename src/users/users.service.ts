import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as argon2 from 'argon2';
import { Parser } from 'json2csv';

// Schemas & DTOs
import { User, UserDocument } from './schemas/user.schema';
import { Role } from '../common/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

// Services & Enums
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';

@Injectable()
export class UsersService {
  private logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel('Department')
    private departmentModel: Model<any>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ================= Read Operations (ค้นหาข้อมูล) =================

  // ค้นหาข้อมูลของตัวเอง (My Profile) โดยใช้ข้อมูลจาก Token ที่ถูกส่งมาใน Request
  async findMe(user: any) {
    return this.userModel
      .findById(user.id)
      .populate('department')
      .select('-passwordHash -refreshTokenHash')
      .exec();
  }

  // ค้นหาผู้ใช้ด้วย _id ซึ่งเป็น ObjectId ของ MongoDB
  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  // ค้นหาผู้ใช้ด้วย userId (ซึ่งเป็น unique identifier ที่ไม่ใช่ _id)
  async findByUserId(userId: string) {
    return this.userModel.findOne({ userId }).exec();
  }

  // ค้นหาผู้ใช้ด้วย userId พร้อมดึงข้อมูลความลับ (passwordHash และ refreshTokenHash) มาให้ด้วย
  async findByUserIdWithSecrets(userId: string) {
    return this.userModel
      .findOne({ userId })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  // ค้นหาผู้ใช้ด้วย _id พร้อมดึงข้อมูล refreshTokenHash มาให้ด้วย (ใช้ในกรณีตรวจสอบ Token ตอนรีเฟรช)
  async findByIdWithRefresh(id: string) {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  // ค้นหาผู้ใช้ด้วย passwordResetToken พร้อมตรวจสอบว่า Token ยังไม่หมดอายุ (ใช้ในกรณีรีเซ็ตรหัสผ่าน)
  async findByResetToken(hashedToken: string) {
    return this.userModel
      .findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      })
      .select('+passwordHash')
      .exec();
  }

  // ค้นหาผู้ใช้ทั้งหมด โดยมีการกรองข้อมูลตามสิทธิ์ของผู้ใช้งานที่ทำการร้องขอมา
  async findAll(currentUser: any) {
    const actorId = currentUser.id || currentUser.sub;
    const { role, department } = currentUser;

    // 1. ADMIN และ HR สามารถเห็นข้อมูลผู้ใช้ทั้งหมด
    if (role === Role.ADMIN || role === Role.HR) {
      return this.userModel.find().populate('department').exec();
    }

    // 2. MANAGER สามารถเห็นข้อมูลของตัวเองและพนักงานในแผนกเดียวกัน
    if (role === Role.MANAGER) {
      // ตรวจสอบว่ามีค่า department ส่งมาไหม ถ้าไม่มีให้เห็นแค่ตัวเองป้องกัน Error
      if (!department) {
        return this.userModel
          .find({ _id: actorId })
          .populate('department')
          .exec();
      }

      // ค้นหาผู้ใช้ที่มี _id เป็นของตัวเอง หรือมี department เป็นแผนกเดียวกันกับที่ Manager อยู่
      return this.userModel
        .find({
          $or: [
            { _id: new Types.ObjectId(actorId) }, // ตัวเอง
            { department: new Types.ObjectId(department) }, // พนักงานทุกคนในแผนกเดียวกัน
          ],
        })
        .populate('department')
        .exec();
    }

    // 3. EMPLOYEE สามารถเห็นข้อมูลของตัวเองเท่านั้น
    if (role === Role.EMPLOYEE) {
      return this.userModel
        .find({ _id: actorId })
        .populate('department')
        .exec();
    }

    return [];
  }

  // ================= Write Operations (สร้าง/แก้ไข/ลบ) =================

  // สร้างผู้ใช้ใหม่ (ใช้ในกรณีที่ระบบอื่นๆ ต้องการสร้างบัญชีผู้ใช้ เช่น ระบบสมัครงาน หรือ Admin สร้างบัญชีให้พนักงาน)
  async create(data: Partial<User>) {
    return this.userModel.create({
      ...data,
      role: data.role ?? Role.EMPLOYEE,
    });
  }

  // สร้างผู้ใช้ใหม่ โดยมีการตรวจสอบสิทธิ์และเงื่อนไขต่างๆ ก่อนการสร้าง (ใช้ในกรณีที่มีการสร้างผ่าน Admin หรือ HR เท่านั้น)
  async createUser(dto: CreateUserDto, currentUser: any) {
    const actorRole = currentUser.role;
    const actorId = currentUser.id || currentUser.sub; // ดึง ID คนทำเพื่อใช้บันทึก Log

    // ตรวจสอบสิทธิ์การสร้างผู้ใช้ (Permission Checks)
    if (actorRole === Role.EMPLOYEE || actorRole === Role.MANAGER) {
      throw new ForbiddenException('ไม่มีสิทธิ์สร้างผู้ใช้');
    }

    /// ================= ADMIN =================
    if (actorRole === Role.ADMIN) {
      if (dto.role === Role.ADMIN) {
        throw new ForbiddenException('ADMIN ห้ามสร้าง ADMIN');
      }
    }

    // ================= HR =================
    if (actorRole === Role.HR) {
      if (dto.role === Role.ADMIN || dto.role === Role.HR) {
        throw new ForbiddenException('HR ห้ามสร้าง ADMIN หรือ HR');
      }
    }

    // ตรวจสอบว่าแผนกที่ส่งมามีอยู่จริงในระบบหรือไม่ (Department Existence Check)
    const departmentName = dto.department;
    const foundDept = await this.departmentModel
      .findOne({
        name: new RegExp(`^${departmentName}$`, 'i'), // ค้นหาแบบไม่สนตัวพิมพ์เล็ก-ใหญ่
      })
      .exec();
    if (!foundDept) {
      throw new NotFoundException(`ไม่พบแผนกชื่อ: ${departmentName}`);
    }

    // ตรวจสอบว่า userId ที่จะสร้างใหม่ไม่ซ้ำกับที่มีอยู่แล้วในระบบ (Unique Check)
    const existingUser = await this.userModel
      .findOne({ userId: dto.userId })
      .exec();
    if (existingUser) {
      throw new BadRequestException(`ไอดีผู้ใช้ ${dto.userId} ถูกใช้งานไปแล้ว`);
    }

    const rawPassword = dto.password || '12345678'; // ถ้ารับค่า password มาจากหน้าบ้าน ให้ใช้ค่านั้น ถ้าไม่มีให้ตั้ง Default (เช่น 123456)
    const passwordHash = await argon2.hash(rawPassword); // ทำการเข้ารหัสด้วย argon2

    // ประกอบร่างข้อมูลใหม่ โดยแยก password ดิบออก และใส่ passwordHash เข้าไปแทน
    const { password, department, ...restDto } = dto as any;
    const userData = {
      ...restDto,
      department: foundDept._id, // แทนชื่อแผนกด้วย ID ของแผนกที่ค้นเจอ
      passwordHash: passwordHash, // ส่งตัวที่ Hash แล้วให้ Mongoose
    };

    const newUser = await this.userModel.create(userData); // สร้างผู้ใช้ใหม่ในฐานข้อมูล
    const actor = await this.userModel.findById(actorId).exec(); // บันทึก Audit Log ว่าใครเป็นคนสร้างผู้ใช้คนนี้ (Actor) และข้อมูลที่ถูกสร้าง (New Value)

    await this.auditLogsService.log({
      actorId: new Types.ObjectId(actorId),
      actorInfo: {
        full_name: actor?.full_name || currentUser?.full_name || 'ไม่พบชื่อ',
        role: actorRole,
        userId: actor?.userId || currentUser?.userId || 'N/A',
      },
      action: AuditAction.CREATE_USER,
      targetId: String(newUser._id),
      details: `สร้างบัญชีผู้ใช้ใหม่: ${newUser.full_name} (สิทธิ์: ${newUser.role})`,
      oldValue: null,
      newValue: restDto,
    });

    return newUser;
  }

  // แก้ไขข้อมูลผู้ใช้ โดยมีการตรวจสอบสิทธิ์และเงื่อนไขต่างๆ อย่างละเอียดก่อนการแก้ไข (ใช้ในกรณีที่มีการแก้ไขผ่าน Admin หรือ HR เท่านั้น)
  async updateUser(targetId: string, dto: UpdateUserDto, currentUser: any) {
    const actorId = currentUser.id || currentUser.sub;
    const actorRole = currentUser.role;

    // ตรวจสอบว่าผู้ใช้เป้าหมาย (Target User) ที่จะทำการแก้ไขมีอยู่จริงหรือไม่
    const targetUser = await this.userModel.findById(targetId);
    if (!targetUser) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    // ================= ตรวจสอบสิทธิ์ (Permission Checks) =================
    if (actorRole === Role.MANAGER || actorRole === Role.EMPLOYEE) {
      throw new ForbiddenException(`${actorRole} ไม่มีสิทธิ์แก้ไขข้อมูลในระบบ`);
    }

    // ================= กรณีที่แก้ไขข้อมูลของตัวเอง (Self-Edit) =================
    let finalDto = dto;
    if (actorId === targetId) {
      const { role, salary, department, position, ...safeDto } = dto as any;
      finalDto = safeDto; // ใช้ safeDto แทน เพื่อให้แก้ได้แค่บางส่วน
    }

    // ================= ADMIN =================
    if (actorRole === Role.ADMIN) {
      // ห้ามแก้ไขข้อมูลของ ADMIN คนอื่น (แต่แก้ตัวเองได้)
      if (targetUser.role === Role.ADMIN && actorId !== targetId) {
        throw new ForbiddenException('ADMIN ห้ามแก้ไขข้อมูลของ ADMIN ท่านอื่น');
      }

      // ป้องกัน ADMIN อัปเกรดตำแหน่งให้พนักงานเป็น ADMIN
      if (finalDto.role === Role.ADMIN && targetUser.role !== Role.ADMIN) {
        throw new ForbiddenException('ห้ามเปลี่ยนสิทธิ์พนักงานเป็น ADMIN');
      }

      return this.applyUpdate(targetUser, finalDto, actorId, currentUser);
    }

    // ================= HR =================
    if (actorRole === Role.HR) {
      if (targetUser.role === Role.ADMIN) {
        throw new ForbiddenException('HR ห้ามแก้ไขข้อมูลของ ADMIN เด็ดขาด');
      }

      // ห้ามแก้ HR คนอื่น (แต่แก้ตัวเองได้)
      if (targetUser.role === Role.HR && actorId !== targetId) {
        throw new ForbiddenException('HR ห้ามแก้ไขข้อมูลของ HR ท่านอื่น');
      }

      // ป้องกัน HR อัปเกรดตำแหน่งให้พนักงานเป็น ADMIN หรือ HR
      if (finalDto.role === Role.ADMIN || finalDto.role === Role.HR) {
        throw new ForbiddenException('HR ห้ามตั้งพนักงานเป็น ADMIN หรือ HR');
      }

      return this.applyUpdate(targetUser, finalDto, actorId, currentUser);
    }

    throw new ForbiddenException('ไม่มีสิทธิ์ดำเนินการ');
  }

  // ลบผู้ใช้ โดยมีการตรวจสอบสิทธิ์และเงื่อนไขต่างๆ อย่างละเอียดก่อนการลบ (ใช้ในกรณีที่มีการลบผ่าน Admin หรือ HR เท่านั้น)
  async deleteUser(targetId: string, currentUser: any) {
    const actorId = currentUser.id || currentUser.sub;
    const actorRole = currentUser.role;

    // ตรวจสอบว่าผู้ใช้เป้าหมาย (Target User) ที่จะทำการลบมีอยู่จริงหรือไม่
    const targetUser = await this.userModel.findById(targetId);
    if (!targetUser) throw new NotFoundException('ไม่พบผู้ใช้');

    // ================= ตรวจสอบสิทธิ์ (Permission Checks) =================
    if (actorRole === Role.ADMIN) {
      if (targetUser.role === Role.ADMIN) {
        throw new ForbiddenException('ADMIN ห้ามลบ ADMIN');
      }
    } else if (actorRole === Role.HR) {
      if (targetUser.role === Role.ADMIN || targetUser.role === Role.HR) {
        throw new ForbiddenException('HR ห้ามลบ ADMIN / HR');
      }
    } else {
      // ดัก MANAGER, EMPLOYEE และคนอื่นๆ ที่ไม่มีสิทธิ์ให้เด้งออกทันที
      throw new ForbiddenException('ไม่มีสิทธิ์ลบ');
    }

    // ================= ดำเนินการลบและบันทึก Log =================

    // ดึงข้อมูลคนทำ (Actor) มาจาก DB ก่อนลบ
    const actor = await this.userModel.findById(actorId).exec();
    const oldValue = targetUser.toObject();

    // ดำเนินการลบผู้ใช้เป้าหมายออกจากฐานข้อมูล
    await this.userModel.findByIdAndDelete(targetId).exec();

    // บันทึก Log ว่าใครเป็นคนลบ
    await this.auditLogsService.log({
      actorId: new Types.ObjectId(actorId),
      actorInfo: {
        full_name: actor?.full_name || currentUser?.full_name || 'ไม่พบชื่อ',
        role: actor?.role || currentUser?.role || 'N/A',
        userId: actor?.userId || currentUser?.userId || 'N/A',
      },
      action: AuditAction.DELETE_USER,
      targetId: String(targetUser._id),
      details: `ลบข้อมูลพนักงาน: ${targetUser.full_name}`,
      oldValue: oldValue,
      newValue: null,
    });

    return { message: 'ลบสำเร็จ' };
  }

  // ================= INTERNAL METHODS & UTILITIES =================

  // ฟังก์ชันภายในสำหรับการอัปเดตข้อมูลผู้ใช้ โดยมีการบันทึก Audit Log อย่างละเอียดทุกครั้งที่มีการแก้ไขข้อมูล
  private async applyUpdate(
    targetUser: any,
    dto: UpdateUserDto,
    actorId: string,
    currentUser: any,
  ) {
    // ดึงข้อมูลคนทำ (Actor) มาจาก DB ก่อนอัปเดต เพื่อใช้บันทึก Log ว่าใครเป็นคนแก้ไข และข้อมูลเก่ากับใหม่เป็นอย่างไร
    const actor = await this.userModel.findById(actorId).exec();
    const oldValue = targetUser.toObject();

    // ดำเนินการอัปเดตข้อมูลผู้ใช้เป้าหมายในฐานข้อมูล โดยใช้ findByIdAndUpdate พร้อมตัวเลือก returnDocument: 'after' เพื่อให้ได้ข้อมูลหลังอัปเดตกลับมา
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        targetUser._id,
        { $set: dto },
        { returnDocument: 'after', runValidators: false },
      )
      .exec();

    // บันทึก Log ว่าใครเป็นคนแก้ไข และข้อมูลเก่ากับใหม่เป็นอย่างไร
    await this.auditLogsService.log({
      actorId: new Types.ObjectId(actorId),
      actorInfo: {
        full_name: actor?.full_name || currentUser?.full_name || 'ไม่พบชื่อ',
        role: actor?.role || currentUser?.role || 'N/A',
        userId: actor?.userId || currentUser?.userId || 'N/A',
      },
      action: AuditAction.UPDATE_USER,
      targetId: String(targetUser._id),
      details: `แก้ไขข้อมูลพนักงาน: ${targetUser.full_name}`,
      oldValue: oldValue,
      newValue: dto,
    });

    return updatedUser;
  }

  // ฟังก์ชันสำหรับส่งออกรายงานข้อมูลพนักงานทั้งหมดในรูปแบบ CSV โดยมีการตรวจสอบสิทธิ์ก่อนการส่งออก และบันทึก Audit Log ทุกครั้งที่มีการส่งออก
  async exportReport(currentUser: any) {
    if (!currentUser || !currentUser.role) {
      throw new ForbiddenException(
        'ไม่พบข้อมูลผู้ใช้งาน หรือ Token ไม่ถูกต้อง',
      );
    }

    // ตรวจสอบสิทธิ์การส่งออกรายงาน (เฉพาะ ADMIN และ HR เท่านั้นที่สามารถส่งออกได้)
    if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.HR) {
      throw new ForbiddenException(
        'เฉพาะ ADMIN หรือ HR เท่านั้นที่สามารถส่งออกรายงานได้',
      );
    }

    // ดึงข้อมูลผู้ใช้ทั้งหมดจากฐานข้อมูล พร้อมกับข้อมูลแผนก และเลือกเฉพาะฟิลด์ที่จำเป็นสำหรับรายงาน (full_name, role, position, salary, department)
    const users = await this.userModel
      .find()
      .populate('department')
      .select('full_name role position salary department')
      .lean();

    // ปรับ Format ข้อมูลให้ตรงกับที่ต้องการส่งออกในรายงาน (เช่น แทนที่ department ด้วยชื่อแผนก)
    const formatted = users.map((u: any) => ({
      full_name: u.full_name || '',
      role: u.role || '',
      position: u.position || '',
      salary: u.salary || 0,
      department: u.department?.name || '',
    }));

    // เพิ่มการบันทึก Audit Log สำหรับการ Export ตรงนี้
    const actorId = currentUser.id || currentUser.sub;
    const actor = await this.userModel.findById(actorId).exec();

    await this.auditLogsService.log({
      actorId: new Types.ObjectId(actorId),
      actorInfo: {
        full_name: actor?.full_name || currentUser?.full_name || 'ไม่พบชื่อ',
        role: currentUser.role,
        userId: actor?.userId || currentUser?.userId || 'N/A',
      },
      action: AuditAction.EXPORT_REPORT,
      targetId: 'SYSTEM', // แจ้งว่าเป้าหมายคือระบบทั้งหมด ไม่ใช่ user คนใดคนหนึ่ง
      details: `ส่งออกรายงานข้อมูลพนักงานจำนวน ${users.length} รายการ`,
      oldValue: null,
      newValue: null,
    });

    const parser = new Parser();
    return parser.parse(formatted);
  }

  // ฟังก์ชันสำหรับค้นหาผู้ใช้ที่มีคำขอรีเซ็ตรหัสผ่าน (Password Reset Requests) โดยจะค้นหาผู้ใช้ที่มีฟิลด์ passwordResetToken และ Token นั้นยังไม่หมดอายุ เพื่อให้หน้าบ้านสามารถแสดงรายการคำขอรีเซ็ตรหัสผ่านได้
  async findAllResetRequests() {
    // ค้นหา User ทุกคนที่มีฟิลด์ passwordResetToken และ Token นั้นยังไม่หมดอายุ
    const users = await this.userModel
      .find({
        passwordResetToken: { $ne: null }, // มี Token อยู่
        passwordResetExpires: { $gt: new Date() }, // และยังไม่หมดอายุ (Greater Than Now)
      })
      .select('full_name userId _id') // เลือกเฉพาะฟิลด์ที่หน้าบ้านต้องใช้แสดงผล
      .exec();

    // ปรับ Format ข้อมูลให้ตรงกับที่หน้าบ้าน (Frontend) รอรับ
    // หน้าบ้านเรียกใช้ req.user.full_name ดังนั้นเราจะครอบ user: { ... } ให้ครับ
    return users.map((user) => ({
      _id: user._id, // นี่คือ requestId (ในกรณีที่คุณไม่ได้สร้าง Schema แยก)
      user: {
        _id: user._id,
        full_name: user.full_name,
        userId: user.userId,
      },
    }));
  }

  // ฟังก์ชันสำหรับนับจำนวนผู้ใช้ในแผนกหนึ่งๆ โดยรับ departmentId เป็นพารามิเตอร์ และคืนค่าจำนวนผู้ใช้ที่อยู่ในแผนกนั้น (ใช้สำหรับการแสดงสถิติหรือการจัดการแผนก)
  async countUsersInDepartment(departmentId: string): Promise<number> {
    return this.userModel
      .countDocuments({
        department: new Types.ObjectId(departmentId),
      })
      .exec();
  }

  // ฟังก์ชันสำหรับอัปเดตค่า refreshTokenHash ของผู้ใช้ในฐานข้อมูล โดยรับ id ของผู้ใช้และค่า refreshTokenHash ใหม่ (หรือ null ในกรณีที่ต้องการลบค่า) เพื่อใช้ในการจัดการ Token สำหรับการรีเฟรช (Refresh Token) ในระบบ Authentication
  setRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    return this.userModel.updateOne({ _id: id }, { refreshTokenHash }).exec();
  }
}
