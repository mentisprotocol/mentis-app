import nodemailer from 'nodemailer';
import axios from 'axios';
import { database } from '../config/database';
import { logger } from '../utils/logger';
import { MonitoringAlert, AlertSeverity } from './MonitoringService';

export interface NotificationSettings {
  email_enabled: boolean;
  slack_webhook_url?: string;
  telegram_chat_id?: string;
  webhook_url?: string;
  alert_thresholds: {
    uptime_threshold: number;
    response_time_threshold: number;
    error_rate_threshold: number;
  };
}

export class NotificationService {
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send alert notification to user
   */
  async sendAlert(userId: string, alert: MonitoringAlert): Promise<void> {
    try {
      // Get user notification settings
      const settings = await this.getUserNotificationSettings(userId);
      if (!settings) {
        logger.warn('No notification settings found for user', { userId });
        return;
      }

      // Get user email
      const userResult = await database.query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        logger.warn('User not found', { userId });
        return;
      }

      const user = userResult.rows[0];

      // Send notifications based on settings
      const notifications = [];

      if (settings.email_enabled) {
        notifications.push(this.sendEmailAlert(user, alert));
      }

      if (settings.slack_webhook_url) {
        notifications.push(this.sendSlackAlert(settings.slack_webhook_url, alert));
      }

      if (settings.telegram_chat_id) {
        notifications.push(this.sendTelegramAlert(settings.telegram_chat_id, alert));
      }

      if (settings.webhook_url) {
        notifications.push(this.sendWebhookAlert(settings.webhook_url, alert));
      }

      // Wait for all notifications to complete
      await Promise.allSettled(notifications);

      logger.info('Alert notifications sent', { userId, alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send alert notifications', { userId, alertId: alert.id, error });
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(user: any, alert: MonitoringAlert): Promise<void> {
    try {
      const subject = `🚨 Mentis Alert: ${alert.type} - ${alert.severity.toUpperCase()}`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🤖 Mentis Protocol Alert</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">Alert Details</h2>
              
              <div style="margin: 15px 0;">
                <strong>Severity:</strong> 
                <span style="
                  padding: 4px 8px; 
                  border-radius: 4px; 
                  color: white;
                  background: ${this.getSeverityColor(alert.severity)};
                ">
                  ${alert.severity.toUpperCase()}
                </span>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Type:</strong> ${alert.type}
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Agent ID:</strong> ${alert.agentId}
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Message:</strong><br>
                <div style="background: #f1f3f4; padding: 10px; border-radius: 4px; margin-top: 5px;">
                  ${alert.message}
                </div>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Timestamp:</strong> ${alert.timestamp.toISOString()}
              </div>
              
              <div style="margin-top: 30px; text-align: center;">
                <a href="${process.env.FRONTEND_URL}/dashboard/agents/${alert.agentId}" 
                   style="
                     background: #667eea; 
                     color: white; 
                     padding: 12px 24px; 
                     text-decoration: none; 
                     border-radius: 6px;
                     display: inline-block;
                   ">
                  View Agent Dashboard
                </a>
              </div>
            </div>
          </div>
          
          <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>This alert was generated by your Mentis Protocol AI agent.</p>
            <p>To manage your notification settings, visit your dashboard.</p>
          </div>
        </div>
      `;

      await this.emailTransporter.sendMail({
        from: `"Mentis Protocol" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject,
        html,
      });

      logger.info('Email alert sent', { email: user.email, alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send email alert', { email: user.email, error });
      throw error;
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(webhookUrl: string, alert: MonitoringAlert): Promise<void> {
    try {
      const color = this.getSeverityColor(alert.severity);
      
      const payload = {
        text: `🚨 Mentis Protocol Alert`,
        attachments: [
          {
            color,
            fields: [
              {
                title: 'Severity',
                value: alert.severity.toUpperCase(),
                short: true,
              },
              {
                title: 'Type',
                value: alert.type,
                short: true,
              },
              {
                title: 'Agent ID',
                value: alert.agentId,
                short: true,
              },
              {
                title: 'Timestamp',
                value: alert.timestamp.toISOString(),
                short: true,
              },
              {
                title: 'Message',
                value: alert.message,
                short: false,
              },
            ],
            actions: [
              {
                type: 'button',
                text: 'View Dashboard',
                url: `${process.env.FRONTEND_URL}/dashboard/agents/${alert.agentId}`,
              },
            ],
          },
        ],
      };

      await axios.post(webhookUrl, payload);
      logger.info('Slack alert sent', { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send Slack alert', { error });
      throw error;
    }
  }

  /**
   * Send Telegram alert
   */
  private async sendTelegramAlert(chatId: string, alert: MonitoringAlert): Promise<void> {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('Telegram bot token not configured');
      }

      const message = `
🚨 *Mentis Protocol Alert*

*Severity:* ${alert.severity.toUpperCase()}
*Type:* ${alert.type}
*Agent ID:* \`${alert.agentId}\`
*Timestamp:* ${alert.timestamp.toISOString()}

*Message:*
${alert.message}

[View Dashboard](${process.env.FRONTEND_URL}/dashboard/agents/${alert.agentId})
      `;

      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      });

      logger.info('Telegram alert sent', { chatId, alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send Telegram alert', { chatId, error });
      throw error;
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(webhookUrl: string, alert: MonitoringAlert): Promise<void> {
    try {
      const payload = {
        event: 'alert',
        alert,
        timestamp: new Date().toISOString(),
      };

      await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mentis-Protocol/1.0',
        },
        timeout: 10000,
      });

      logger.info('Webhook alert sent', { webhookUrl, alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send webhook alert', { webhookUrl, error });
      throw error;
    }
  }

  /**
   * Get user notification settings
   */
  private async getUserNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      const result = await database.query(
        'SELECT * FROM notification_settings WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const settings = result.rows[0];
      return {
        email_enabled: settings.email_enabled,
        slack_webhook_url: settings.slack_webhook_url,
        telegram_chat_id: settings.telegram_chat_id,
        webhook_url: settings.webhook_url,
        alert_thresholds: settings.alert_thresholds || {
          uptime_threshold: 95,
          response_time_threshold: 1000,
          error_rate_threshold: 5,
        },
      };
    } catch (error) {
      logger.error('Failed to get notification settings', { userId, error });
      return null;
    }
  }

  /**
   * Update user notification settings
   */
  async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (settings.email_enabled !== undefined) {
        updateFields.push(`email_enabled = $${paramCount++}`);
        values.push(settings.email_enabled);
      }

      if (settings.slack_webhook_url !== undefined) {
        updateFields.push(`slack_webhook_url = $${paramCount++}`);
        values.push(settings.slack_webhook_url);
      }

      if (settings.telegram_chat_id !== undefined) {
        updateFields.push(`telegram_chat_id = $${paramCount++}`);
        values.push(settings.telegram_chat_id);
      }

      if (settings.webhook_url !== undefined) {
        updateFields.push(`webhook_url = $${paramCount++}`);
        values.push(settings.webhook_url);
      }

      if (settings.alert_thresholds !== undefined) {
        updateFields.push(`alert_thresholds = $${paramCount++}`);
        values.push(JSON.stringify(settings.alert_thresholds));
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      await database.query(
        `INSERT INTO notification_settings (user_id, ${updateFields.join(', ').replace(/\$\d+/g, '').replace(/updated_at = CURRENT_TIMESTAMP,/, 'updated_at,')} created_at, updated_at)
         VALUES ($${paramCount}, ${updateFields.map((_, i) => `$${i + 1}`).join(', ')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) 
         DO UPDATE SET ${updateFields.join(', ')}`,
        values
      );

      logger.info('Notification settings updated', { userId });
    } catch (error) {
      logger.error('Failed to update notification settings', { userId, error });
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(userId: string): Promise<void> {
    const testAlert: MonitoringAlert = {
      id: 'test-alert',
      agentId: 'test-agent',
      type: 'test_notification',
      severity: AlertSeverity.MEDIUM,
      message: 'This is a test notification from Mentis Protocol. Your notification settings are working correctly!',
      timestamp: new Date(),
      resolved: false,
    };

    await this.sendAlert(userId, testAlert);
  }

  /**
   * Get severity color for UI
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'low':
        return '#28a745';
      case 'medium':
        return '#ffc107';
      case 'high':
        return '#fd7e14';
      case 'critical':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  }
}
