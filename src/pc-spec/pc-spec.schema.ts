import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PcSpecDocument = PcSpec & Document;

@Schema({ timestamps: true }) 
export class PcSpec {
  @Prop({ required: true })
  title: string; 

  @Prop()
  modelName: string; 

  @Prop()
  os: string; 

  @Prop()
  monitorRefreshRate: number; 

  @Prop({ type: Object })
  hardware: {
    cpu: string;
    gpu: string;
    ram: string;
  };

  @Prop()
  benchmarkScore: number; 

  @Prop()
  userId: string; 
}

export const PcSpecSchema = SchemaFactory.createForClass(PcSpec);