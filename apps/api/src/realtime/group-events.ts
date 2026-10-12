import { Global, Injectable, Module } from '@nestjs/common';
import type { GroupEventName } from '@office-foodie/shared';
type Listener = (event: GroupEventName, slug: string) => Promise<void>;
@Injectable()
export class GroupEvents {
  private readonly listeners = new Set<Listener>();
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async publish(event: GroupEventName, slug: string) {
    await Promise.all(
      [...this.listeners].map((listener) => listener(event, slug)),
    );
  }
}
@Global()
@Module({ providers: [GroupEvents], exports: [GroupEvents] })
export class GroupEventsModule {}
