import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const mail = this.config.get('mail');
    this.from = mail.from || mail.user;
    this.enabled = mail.enabled;

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.secure,
        auth: { user: mail.user, pass: mail.pass },
      });
      this.logger.log(`邮件服务已就绪：${mail.host}:${mail.port}`);
    } else {
      this.logger.warn('未配置邮件账号，邮件发送将跳过（仅落库）');
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      this.logger.warn(`[跳过发送] to=${to} subject=${subject}`);
      return false;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`邮件已发送 to=${to} subject=${subject}`);
      return true;
    } catch (e) {
      this.logger.error(`邮件发送失败 to=${to}：${(e as Error).message}`);
      return false;
    }
  }

  /** 学习日报模板 */
  buildDailyReportHtml(params: {
    nickname: string;
    date: string;
    content: string;
    stats: { duration: number; words: number; courses: number; mastered: number };
  }): string {
    const { nickname, date, content, stats } = params;
    const minutes = Math.round(stats.duration / 60);
    return `<div style="max-width:640px;margin:0 auto;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#f6f8fb;padding:24px">
  <div style="background:#fff;border-radius:14px;padding:28px;box-shadow:0 6px 24px rgba(31,64,120,.08)">
    <h2 style="margin:0 0 4px;font-size:20px;color:#12213a">Hi ${nickname}，这是你的学习日报</h2>
    <p style="margin:0 0 20px;color:#8b96a5;font-size:13px">${date}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
      <tr>
        <td style="padding:12px;background:#f2f7ff;border-radius:10px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#1677ff">${minutes}</div>
          <div style="font-size:12px;color:#8b96a5">今日学习(分钟)</div>
        </td>
        <td style="width:12px"></td>
        <td style="padding:12px;background:#f2fff6;border-radius:10px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#22a06b">${stats.words}</div>
          <div style="font-size:12px;color:#8b96a5">复习单词</div>
        </td>
        <td style="width:12px"></td>
        <td style="padding:12px;background:#fff7f2;border-radius:10px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#e07b39">${stats.mastered}</div>
          <div style="font-size:12px;color:#8b96a5">累计掌握</div>
        </td>
      </tr>
    </table>

    <div style="line-height:1.85;color:#33415c;font-size:14px;white-space:pre-wrap">${content}</div>

    <p style="margin:26px 0 0;color:#a8b1bd;font-size:12px;border-top:1px solid #eef1f5;padding-top:16px">
      本邮件由英语学习平台自动发送，请勿直接回复。
    </p>
  </div>
</div>`;
  }
}
