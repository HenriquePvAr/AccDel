import { SetMetadata } from '@nestjs/common'

import { REQUIRED_PERMISSIONS_KEY } from '../auth.constants'
import type { AdminPermission } from '../auth.permissions'

export const Permissions = (...permissions: AdminPermission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions)
