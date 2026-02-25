import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true })
export class Department {
  @Prop({
    required: true,
    unique: true,
    trim: true,
  })
  name: string;

  @Prop({
    trim: true,
  })
  description?: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
