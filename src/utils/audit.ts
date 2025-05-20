import winston from 'winston';
import path from 'path';
import fs from 'fs';

export interface AuditLog {
  timestamp: Date;
  clientID: string;
  action: string;
  resource: string;
  result: string;
  details?: Record<string, any>;
}

export class AuditLogger {
  private logger: winston.Logger;
  
  constructor(logPath: string = './logs') {
    // Create log directory if it doesn't exist
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        // Write to console in development
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        // Write audit logs to a file
        new winston.transports.File({ 
          filename: path.join(logPath, 'audit.log')
        })
      ]
    });
  }
  
  /**
   * Log an audit event
   */
  log(clientID: string, action: string, resource: string, result: string, details?: Record<string, any>) {
    const auditLog: AuditLog = {
      timestamp: new Date(),
      clientID,
      action,
      resource,
      result,
      details
    };
    
    this.logger.info('AUDIT', auditLog);
  }
}

export default AuditLogger;
