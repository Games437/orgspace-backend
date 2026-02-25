export enum Role {
  ADMIN = 'ADMIN', // เห็นทุกอย่างในระบบ
  HR = 'HR', // เห็นข้อมูลพนักงานทั้งหมด
  MANAGER = 'MANAGER', // เห็นเฉพาะพนักงานในแผนกตนเอง
  EMPLOYEE = 'EMPLOYEE', // เห็นเฉพาะข้อมูลตนเอง
}
