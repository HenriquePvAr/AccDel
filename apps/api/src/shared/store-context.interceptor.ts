import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'

import {
  resolveStoreContextFromRequest,
  runWithStoreContext,
  StoreContextResolutionError,
  type StoreScopedRequest,
} from './store-context'

@Injectable()
export class StoreContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<StoreScopedRequest>()
    const storeContext = this.resolveContext(request)

    request.storeId = storeContext.storeId
    request.storeContext = storeContext

    return new Observable((subscriber) =>
      runWithStoreContext(storeContext, () =>
        next.handle().subscribe({
          next: (value: unknown) => subscriber.next(value),
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        }),
      ),
    )
  }

  private resolveContext(request: StoreScopedRequest) {
    try {
      return resolveStoreContextFromRequest(request)
    } catch (error) {
      if (error instanceof StoreContextResolutionError) {
        throw new BadRequestException(error.message)
      }

      throw error
    }
  }
}
