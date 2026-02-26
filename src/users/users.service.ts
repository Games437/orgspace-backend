import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Role } from '../common/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Parser } from 'json2csv';
import { CreateUserDto } from './dto/create-user.dto';
import * as argon2 from 'argon2';
import { AuditAction } from '../common/enums/audit-action.enum';
import { Department } from '../departments/schemas/department.schema';

@Injectable()
export class UsersService {
  private logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>, // ตัวแปรแรกคือ User

    @InjectModel('Department')
    private departmentModel: Model<any>, // ตัวแปรที่สองคือ Department (ห้ามวาง @InjectModel ซ้อนกันบนบรรทัดเดียว)

    private readonly auditLogsService: AuditLogsService,
  ) {}

  findByUserId(userId: string) {
    return this.userModel.findOne({ userId }).exec();
  }

  findByUserIdWithSecrets(userId: string) {
    return this.userModel
      .findOne({ userId })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  findByIdWithRefresh(id: string) {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async create(data: Partial<User>) {
    return this.userModel.create({
      ...data,
      role: data.role ?? Role.EMPLOYEE,
    });
  }

  setRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    return this.userModel.updateOne({ _id: id }, { refreshTokenHash }).exec();
  }

  async findById(id: string) {
    // ค้นหาด้วย _id ของ MongoDB
    return this.userModel.findById(id).exec();
  }

  async findMe(user: any) {
    return this.userModel
      .findById(user.id)
      .populate('department')
      .select('-passwordHash -refreshTokenHash')
      .exec();
  }

  async findAll(currentUser: any) {
    const actorId = currentUser.id || currentUser.sub;
    const { role, department } = currentUser;

    if (role === Role.ADMIN || role === Role.HR) {
      return this.userModel.find().populate('department').exec();
    }

    if (role === Role.MANAGER) {
      return this.userModel
        .find({
          $or: [
            { _id: new Types.ObjectId(actorId) },
            { department: new Types.ObjectId(department) },
          ],
        })
        .populate('department')
        .exec();
    }

    if (role === Role.EMPLOYEE) {
      return this.userModel
        .find({ _id: actorId })
        .populate('department')
        .exec();
    }

    return [];
  }

  async createUser(dto: CreateUserDto, currentUser: any) {
    const actorRole = currentUser.role;
    // ดึง ID คนทำเพื่อใช้บันทึก Log
    const actorId = currentUser.id || currentUser.sub;

    // 1. ป้องกัน EMPLOYEE และ MANAGER สร้างผู้ใช้
    if (actorRole === Role.EMPLOYEE || actorRole === Role.MANAGER) {
      throw new ForbiddenException('ไม่มีสิทธิ์สร้างผู้ใช้');
    }

    // ================= ADMIN =================
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
    // 🚀 3. ค้นหา ID ของแผนกจากชื่อที่ส่งมา
    const departmentName = dto.department;
    const foundDept = await this.departmentModel
      .findOne({
        name: new RegExp(`^${departmentName}$`, 'i'), // ค้นหาแบบไม่สนตัวพิมพ์เล็ก-ใหญ่
      })
      .exec();

    if (!foundDept) {
      throw new NotFoundException(`ไม่พบแผนกชื่อ: ${departmentName}`);
    }
    // ถ้ารับค่า password มาจากหน้าบ้าน ให้ใช้ค่านั้น ถ้าไม่มีให้ตั้ง Default (เช่น 123456)
    const rawPassword = dto.password || '12345678';

    // ทำการเข้ารหัสด้วย argon2
    const passwordHash = await argon2.hash(rawPassword);

    // ประกอบร่างข้อมูลใหม่ โดยแยก password ดิบออก และใส่ passwordHash เข้าไปแทน
    const { password, department, ...restDto } = dto as any;
    const userData = {
      ...restDto,
      department: foundDept._id, // แทนชื่อแผนกด้วย ID ของแผนกที่ค้นเจอ
      passwordHash: passwordHash, // 👈 ส่งตัวที่ Hash แล้วให้ Mongoose
    };

    // 2. ถ้ารอดเงื่อนไขทั้งหมดมาได้ ก็สร้าง User ลงฐานข้อมูล (เขียนแค่ครั้งเดียวพอ)
    const newUser = await this.userModel.create(userData);

    // 3. บันทึก Audit Log (ใครเป็นคนสร้างพนักงานคนนี้)
    const actor = await this.userModel.findById(actorId).exec();
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
      newValue: restDto, // เก็บข้อมูลที่ใช้สร้างไว้เป็นหลักฐาน
    });

    return newUser;
  }

  async updateUser(targetId: string, dto: UpdateUserDto, currentUser: any) {
    const actorId = currentUser.id || currentUser.sub;
    const actorRole = currentUser.role;

    const targetUser = await this.userModel.findById(targetId);
    if (!targetUser) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    // 1. MANAGER และ EMPLOYEE ห้ามแก้ไขข้อมูลใดๆ ทั้งสิ้น (บล็อกตั้งแต่ด่านแรก)
    if (actorRole === Role.MANAGER || actorRole === Role.EMPLOYEE) {
      throw new ForbiddenException(`${actorRole} ไม่มีสิทธิ์แก้ไขข้อมูลในระบบ`);
    }

    // 2. ป้องกันการทุจริตเมื่อ "แก้ไขข้อมูลของตัวเอง" (Self-Edit)
    // ไม่ว่าจะเป็น ADMIN หรือ HR ถ้าแก้ข้อมูลตัวเอง จะถูกตัดฟิลด์สำคัญทิ้ง (แก้ได้แค่ชื่อ ฯลฯ)
    let finalDto = dto;
    if (actorId === targetId) {
      const { role, salary, department, position, ...safeDto } = dto as any;
      finalDto = safeDto; // ใช้ safeDto แทน เพื่อให้แก้ได้แค่บางส่วน
    }

    // 3. ================= ADMIN =================
    if (actorRole === Role.ADMIN) {
      // ห้ามแก้ ADMIN คนอื่น (แต่แก้ตัวเองได้ เพราะ actorId === targetId จะหลุดเงื่อนไขนี้)
      if (targetUser.role === Role.ADMIN && actorId !== targetId) {
        throw new ForbiddenException('ADMIN ห้ามแก้ไขข้อมูลของ ADMIN ท่านอื่น');
      }

      // ห้ามเสกคนอื่นเป็น ADMIN
      if (finalDto.role === Role.ADMIN && targetUser.role !== Role.ADMIN) {
        throw new ForbiddenException('ห้ามเปลี่ยนสิทธิ์พนักงานเป็น ADMIN');
      }

      return this.applyUpdate(targetUser, finalDto, actorId, currentUser);
    }

    // 4. ================= HR =================
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

  async deleteUser(targetId: string, currentUser: any) {
    const actorId = currentUser.id || currentUser.sub;
    const actorRole = currentUser.role;

    const targetUser = await this.userModel.findById(targetId);
    if (!targetUser) throw new NotFoundException('ไม่พบผู้ใช้');

    // ================= 1. ตรวจสอบสิทธิ์ (Permission Checks) =================
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

    // ================= 2. ดำเนินการลบและบันทึก Log =================

    // ดึงข้อมูลคนทำ (Actor) มาจาก DB ก่อนลบ
    const actor = await this.userModel.findById(actorId).exec();
    const oldValue = targetUser.toObject();

    // ทำการลบข้อมูล (ใช้ findByIdAndDelete แบบเดิม หรือ targetUser.deleteOne() ก็ได้)
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

  private async applyUpdate(
    targetUser: any,
    dto: UpdateUserDto,
    actorId: string,
    currentUser: any,
  ) {
    const actor = await this.userModel.findById(actorId).exec();
    const oldValue = targetUser.toObject();

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        targetUser._id,
        { $set: dto },
        { returnDocument: 'after', runValidators: false },
      )
      .exec();

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

  async exportReport(currentUser: any) {
    if (!currentUser || !currentUser.role) {
      throw new ForbiddenException(
        'ไม่พบข้อมูลผู้ใช้งาน หรือ Token ไม่ถูกต้อง',
      );
    }

    if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.HR) {
      throw new ForbiddenException(
        'เฉพาะ ADMIN หรือ HR เท่านั้นที่สามารถส่งออกรายงานได้',
      );
    }

    const users = await this.userModel
      .find()
      .populate('department')
      .select('full_name role position salary department')
      .lean();

    const formatted = users.map((u: any) => ({
      full_name: u.full_name || '',
      role: u.role || '',
      position: u.position || '',
      salary: u.salary || 0,
      department: u.department?.name || '',
    }));

    // ✅ เพิ่มการบันทึก Audit Log สำหรับการ Export ตรงนี้
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
  async findByResetToken(hashedToken: string) {
    return this.userModel
      .findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();
  }
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
}
