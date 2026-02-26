import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  // ================= ACCOUNT IDENTITY (ข้อมูลระบุตัวตนและบัญชี) =================
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  userId: string;

  @Prop({ required: true, trim: true })
  full_name: string;

  @Prop({
    enum: Role,
    default: Role.EMPLOYEE,
  })
  role: Role;

  // ================= EMPLOYEE INFO (ข้อมูลการจ้างงาน) =================

  @Prop({
    type: Types.ObjectId,
    ref: 'Department',
    required: true,
  })
  department: Types.ObjectId;

  @Prop({ required: true })
  salary: number;

  @Prop({ required: true, trim: true })
  position: string;

  // ================= SECURITY & AUTH (ความปลอดภัยและการเข้าถึง) =================

  @Prop({
    required: true,
    select: false,
  })
  passwordHash: string;

  @Prop({
    type: String,
    select: false,
    default: null,
  })
  refreshTokenHash?: string | null;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  // ================= LOGIN PROTECTION (ระบบป้องกันการเดารหัสผ่าน) =================

  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
