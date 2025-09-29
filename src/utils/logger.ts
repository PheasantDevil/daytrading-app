export class Logger {
  private name: string;
  private level: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private consoleOutput: boolean = true;
  private fileOutput?: string;

  constructor(name: string) {
    this.name = name;
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.level = level;
  }

  setFileOutput(filePath: string): void {
    this.fileOutput = filePath;
  }

  disableConsoleOutput(): void {
    this.consoleOutput = false;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}${formattedArgs}`;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, ...args);

    if (this.consoleOutput) {
      switch (level) {
        case 'debug':
          console.debug(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'error':
          console.error(formattedMessage);
          break;
      }
    }

    if (this.fileOutput) {
      // ファイル出力の実装は簡略化
      // 実際の実装では fs.appendFileSync などを使用
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }
}
