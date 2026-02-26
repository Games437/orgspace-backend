import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AuditAction } from 'src/common/enums/audit-action.enum';

export type AuditLogDocument = AuditLog & Document;

@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actorId: MongooseSchema.Types.ObjectId;

  @Prop({ type: Object })
  actorInfo: {
    full_name: string;
    role: string;
    userId: string;
  };

  @Prop({ required: true, enum: AuditAction })
  action: string;

  @Prop({ type: String })
  details: string;

  @Prop({ type: String, required: true })
  targetId: string;

  @Prop({ type: Object })
  oldValue: any;

  @Prop({ type: Object })
  newValue: any;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
