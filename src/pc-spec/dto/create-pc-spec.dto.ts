export class CreatePcSpecDto {
  title: string;
  modelName: string;
  os: string;
  monitorRefreshRate: number;
  hardware: {
    cpu: string;
    gpu: string;
    ram: string;
  };
  benchmarkScore: number;
  userId: string;
}