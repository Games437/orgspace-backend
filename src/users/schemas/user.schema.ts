import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  userId: string;

  @Prop({
    required: true,
    select: false,
  })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  full_name: string;

  @Prop({ required: true })
  salary: number;

  @Prop({ required: true, trim: true })
  position: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Department',
    required: true,
  })
  department: Types.ObjectId;

  @Prop({
    enum: Role,
    default: Role.EMPLOYEE,
  })
  role: Role;

  @Prop({
    type: String,
    select: false,
    default: null,
  })
  refreshTokenHash?: string | null;

  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
