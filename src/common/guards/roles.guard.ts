import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

interface RequestUser {
  sub: string;
  role: Role;
  department: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้ในระบบ');
    }

    if (!user.role) {
      throw new UnauthorizedException('Token ไม่ถูกต้อง');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงข้อมูลในส่วนนี้');
    }

    return true;
  }
}
