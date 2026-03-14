// Logger utility for JobJourney Extension
export class Logger {
  private static formatMessage(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const emoji = Logger.getLevelEmoji(level);
    let formatted = `${emoji} [${timestamp}] ${message}`;

    if (data) {
      formatted += ` | ${JSON.stringify(data)}`;
    }

    return formatted;
  }

  private static getLevelEmoji(level: string): string {
    switch (level) {
      case 'info':
        return '🔵';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'debug':
        return '🐛';
      default:
        return '📝';
    }
  }

  static info(message: string, data?: unknown): void {
    const formatted = Logger.formatMessage('info', message, data);
    console.log(formatted);
  }

  static success(message: string, data?: unknown): void {
    const formatted = Logger.formatMessage('success', message, data);
    console.log(formatted);
  }

  static warning(message: string, data?: unknown): void {
    const formatted = Logger.formatMessage('warning', message, data);
    console.warn(formatted);
  }

  static error(message: string, error?: unknown): void {
    const formatted = Logger.formatMessage('error', message, error);
    console.error(formatted);

    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }

  static debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      const formatted = Logger.formatMessage('debug', message, data);
      console.log(formatted);
    }
  }

  static warn(message: string, data?: unknown): void {
    Logger.warning(message, data);
  }
}
