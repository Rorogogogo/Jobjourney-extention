// Event management and messaging system for JobJourney Extension
import { Logger } from '../utils/Logger';
import type { EventType, EventData } from '../types';

export class EventManager {
  private listeners = new Map<
    EventType,
    Array<(data: EventData, sender?: chrome.runtime.MessageSender) => Promise<any> | any>
  >();
  private initialized = false;

  /**
   * Initialize the event manager
   */
  initialize(): void {
    if (this.initialized) return;

    this.initialized = true;
    Logger.info('Event manager initialized');
  }

  /**
   * Add event listener
   */
  on(event: EventType, callback: (data: EventData, sender?: chrome.runtime.MessageSender) => Promise<any> | any): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(callback);
    Logger.debug(`Event listener added for: ${event}`);
  }

  /**
   * Remove event listener
   */
  off(
    event: EventType,
    callback: (data: EventData, sender?: chrome.runtime.MessageSender) => Promise<any> | any,
  ): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    const index = eventListeners.indexOf(callback);
    if (index > -1) {
      eventListeners.splice(index, 1);
      Logger.debug(`Event listener removed for: ${event}`);
    }
  }

  /**
   * Emit event to all listeners
   */
  async emit(event: EventType, data: EventData, sender?: chrome.runtime.MessageSender): Promise<any[]> {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.length === 0) {
      Logger.debug(`No listeners for event: ${event}`);
      return [];
    }

    Logger.debug(`Emitting event: ${event}`, { data, sender: sender?.tab?.id });

    const promises = eventListeners.map(async callback => {
      try {
        return await callback(data, sender);
      } catch (error) {
        Logger.error(`Error in event listener for ${event}`, error);
        return null;
      }
    });

    return Promise.all(promises);
  }

  /**
   * Emit event synchronously (for backwards compatibility)
   */
  emitSync(event: EventType, data: EventData, sender?: chrome.runtime.MessageSender): any[] {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.length === 0) {
      return [];
    }

    return eventListeners.map(callback => {
      try {
        return callback(data, sender);
      } catch (error) {
        Logger.error(`Error in sync event listener for ${event}`, error);
        return null;
      }
    });
  }

  /**
   * Get all registered events
   */
  getRegisteredEvents(): EventType[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get listener count for an event
   */
  getListenerCount(event: EventType): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * Clear all listeners for an event
   */
  removeAllListeners(event?: EventType): void {
    if (event) {
      this.listeners.delete(event);
      Logger.debug(`All listeners removed for: ${event}`);
    } else {
      this.listeners.clear();
      Logger.debug('All event listeners cleared');
    }
  }
}
